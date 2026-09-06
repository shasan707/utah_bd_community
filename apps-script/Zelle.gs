/**
 * BPAU Gmail relay. Two quiet jobs, both on timers:
 *
 *   relayZelleEmails  every 5 minutes: take the bank's Zelle alert emails that
 *                     carry the BPAU-Zelle label and hand them to the website,
 *                     which does the matching, the confirming, and the audit log.
 *   sendQueuedEmails  every minute: fetch the emails the website has queued
 *                     (the code email after the form, the receipt after
 *                     confirmation, alerts) and send them from this account
 *                     with MailApp, exactly as the first version did.
 *
 * No web app, no spreadsheet. Setup: see SETUP.md.
 *
 * Script Properties (Project Settings > Script Properties):
 *   WEBSITE_URL     e.g. https://uthahbdcommunity.vercel.app
 *   INBOUND_SECRET  the same value as ZELLE_INBOUND_SECRET on Vercel
 */

var ZELLE_LABEL = 'BPAU-Zelle';
var PROCESSED_LABEL = 'BPAU-Zelle-Processed';
var MAX_THREADS_PER_RUN = 20;
var MAX_BODY_CHARS = 40000;
var MAX_EMAILS_PER_RUN = 20;
var SENDER_NAME = 'BPAU';

function config_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('WEBSITE_URL');
  var secret = props.getProperty('INBOUND_SECRET');
  if (!url || !secret) {
    throw new Error('Set WEBSITE_URL and INBOUND_SECRET in Project Settings > Script Properties.');
  }
  return { url: url.replace(/\/+$/, ''), secret: secret };
}

/**
 * Where bank alerts are looked for. The BPAU-Zelle label still works, but it
 * is no longer required: anything from Wells Fargo or Zelle is checked too,
 * so a missing or mistyped Gmail filter cannot silently stop the automation.
 */
var ALERT_QUERIES = [
  'label:' + ZELLE_LABEL,
  'from:wellsfargo.com',
  'from:zellepay.com OR from:zelle.com'
];

/** Cheap check before relaying, so statements and marketing are not sent over. */
function looksLikeZelleAlert_(subject, body) {
  return /zelle|sent you|received money|payment received|you received/i.test(subject + '\n' + body);
}

/** New threads matching any alert query, each thread once. */
function findNewAlertThreads_() {
  var seen = {};
  var out = [];
  ALERT_QUERIES.forEach(function (q) {
    var threads = GmailApp.search('(' + q + ') -label:' + PROCESSED_LABEL + ' -from:me newer_than:30d', 0, MAX_THREADS_PER_RUN);
    threads.forEach(function (t) {
      var id = t.getId();
      if (!seen[id]) { seen[id] = true; out.push(t); }
    });
  });
  return out;
}

/** Runs on the timer. Safe to run twice: the website ignores emails it has seen. */
function relayZelleEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var cfg = config_();
    var processed = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
    var threads = findNewAlertThreads_();
    if (threads.length === 0) return;

    var messages = [];
    var skipped = 0;
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        var subject = msg.getSubject();
        var body = msg.getPlainBody().substring(0, MAX_BODY_CHARS);
        if (!looksLikeZelleAlert_(subject, body)) { skipped++; return; }
        messages.push({
          message_id: msg.getId(),
          received_at: msg.getDate().toISOString(),
          subject: subject,
          body: body
        });
      });
    });

    if (messages.length === 0) {
      // Nothing Zelle-like in these threads; mark them so they are not scanned again.
      threads.forEach(function (thread) { thread.addLabel(processed); });
      console.log('Checked ' + threads.length + ' thread(s), none looked like a Zelle alert.');
      return;
    }

    var response = UrlFetchApp.fetch(cfg.url + '/api/payments/inbound', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + cfg.secret },
      payload: JSON.stringify({ messages: messages }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      console.error('Relay failed: HTTP ' + response.getResponseCode() + ' ' + response.getContentText().substring(0, 500));
      return; // labels untouched, so the next run retries
    }

    threads.forEach(function (thread) { thread.addLabel(processed); });
    console.log('Relayed ' + messages.length + ' message(s)' + (skipped ? ', skipped ' + skipped : '') + ': ' + response.getContentText().substring(0, 800));
  } finally {
    lock.releaseLock();
  }
}

/**
 * Diagnostic. Run it by hand to see which bank or Zelle emails this mailbox
 * holds, which labels they carry, and whether the relay would pick them up.
 */
function listRecentBankEmails() {
  var threads = GmailApp.search('(from:wellsfargo.com OR from:zellepay.com OR from:zelle.com OR label:' + ZELLE_LABEL + ') newer_than:30d', 0, 20);
  if (threads.length === 0) {
    console.log('No email from Wells Fargo or Zelle in the last 30 days in this mailbox. ' +
      'Either the bank sends alerts to a different address, or forwarding from that address is not set up.');
    return;
  }
  threads.forEach(function (t) {
    var labels = t.getLabels().map(function (l) { return l.getName(); }).join(', ') || 'none';
    t.getMessages().forEach(function (m) {
      var body = m.getPlainBody();
      console.log([
        m.getDate().toISOString(),
        'from ' + m.getFrom(),
        'subject "' + m.getSubject() + '"',
        'labels [' + labels + ']',
        looksLikeZelleAlert_(m.getSubject(), body) ? 'looks like a Zelle alert' : 'not a Zelle alert'
      ].join(' | '));
    });
  });
}

/**
 * Diagnostic. Logs the text of the newest Zelle-looking email so its exact
 * wording can be checked against the website's parser.
 */
function showNewestAlertText() {
  var threads = GmailApp.search('(from:wellsfargo.com OR from:zellepay.com OR from:zelle.com OR label:' + ZELLE_LABEL + ') newer_than:60d', 0, 10);
  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = msgs.length - 1; j >= 0; j--) {
      var m = msgs[j];
      var body = m.getPlainBody();
      if (looksLikeZelleAlert_(m.getSubject(), body)) {
        console.log('From: ' + m.getFrom() + '\nSubject: ' + m.getSubject() + '\n---\n' + body.substring(0, 1500));
        return;
      }
    }
  }
  console.log('No Zelle-looking email found in the last 60 days.');
}

/**
 * Runs on the timer. Asks the website for queued emails, sends each one from
 * this account, and reports back. Safe to run twice: the website hands out
 * each email once and retries only those it never heard back about.
 */
function sendQueuedEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var cfg = config_();
    var quota = MailApp.getRemainingDailyQuota();
    if (quota <= 0) {
      console.warn('Daily email quota used up; queued emails wait until tomorrow.');
      return;
    }
    var limit = Math.min(MAX_EMAILS_PER_RUN, quota);
    var claim = UrlFetchApp.fetch(cfg.url + '/api/email/outbox?limit=' + limit, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + cfg.secret },
      muteHttpExceptions: true
    });
    if (claim.getResponseCode() !== 200) {
      console.error('Outbox claim failed: HTTP ' + claim.getResponseCode() + ' ' + claim.getContentText().substring(0, 500));
      return;
    }
    var data = JSON.parse(claim.getContentText());
    var queue = (data.result && data.result.messages) || [];
    if (queue.length === 0) return;

    var results = queue.map(function (m) {
      try {
        var options = { name: m.from_name || SENDER_NAME };
        if (m.reply_to) options.replyTo = m.reply_to;
        if (m.html) options.htmlBody = m.html; // the ticket; the text stays as the fallback
        MailApp.sendEmail(m.to, m.subject, m.text, options);
        return { id: m.id, ok: true };
      } catch (err) {
        var text = String((err && err.message) || err);
        // A quota error is temporary: the website keeps the email queued
        // without counting it as a failed attempt.
        return { id: m.id, ok: false, error: text.substring(0, 300), retry: /quota|limit|too many times/i.test(text) };
      }
    });

    var report = UrlFetchApp.fetch(cfg.url + '/api/email/outbox', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + cfg.secret },
      payload: JSON.stringify({ results: results }),
      muteHttpExceptions: true
    });
    if (report.getResponseCode() !== 200) {
      // The website will hand the same emails out again after 15 minutes.
      console.error('Outbox report failed: HTTP ' + report.getResponseCode() + ' ' + report.getContentText().substring(0, 500));
      return;
    }
    console.log('Emails: ' + report.getContentText().substring(0, 300));
  } finally {
    lock.releaseLock();
  }
}

/** Run once after setting the Script Properties. Re-run to change the intervals. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('relayZelleEmails').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('sendQueuedEmails').timeBased().everyMinutes(1).create();
  console.log('Triggers installed: relayZelleEmails every 5 minutes, sendQueuedEmails every minute');
}

/** Run once to check the website URL, the secret, and the email quota. */
function testConnection() {
  var cfg = config_();
  var pricing = UrlFetchApp.fetch(cfg.url + '/api/pricing', { muteHttpExceptions: true });
  console.log('Website: HTTP ' + pricing.getResponseCode() + ' ' + pricing.getContentText().substring(0, 200));
  var probe = UrlFetchApp.fetch(cfg.url + '/api/payments/inbound', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.secret },
    payload: JSON.stringify({ messages: [] }),
    muteHttpExceptions: true
  });
  // 400 "No messages." means the secret was accepted. 401 means it was not.
  console.log('Secret check: HTTP ' + probe.getResponseCode() + ' ' + probe.getContentText().substring(0, 200));
  console.log('Emails this account can still send today: ' + MailApp.getRemainingDailyQuota());
}
