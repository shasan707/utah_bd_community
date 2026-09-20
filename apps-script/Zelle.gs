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
 *   WEBSITE_URL     e.g. https://bdutah.jotillabs.com (the vercel.app addresses also work)
 *   INBOUND_SECRET  the same value as ZELLE_INBOUND_SECRET on Vercel
 */

var ZELLE_LABEL = 'BPAU-Zelle';
var PROCESSED_LABEL = 'BPAU-Zelle-Processed';
var MAX_THREADS_PER_RUN = 20;
var MAX_BODY_CHARS = 40000;
var MAX_EMAILS_PER_RUN = 20;
var SENDER_NAME = 'BPAU';

/**
 * How far back each run looks. Every alert inside this window is offered to
 * the website on every run, and the website keeps only the ones it has not
 * seen: raw_emails.message_id is unique, so a repeat comes back as
 * "already_seen" and is dropped. That is what makes it safe to stop using a
 * label to decide what is new, which mattered because Gmail labels whole
 * threads: once a thread was marked processed, every later alert that landed
 * in it became invisible to this script for good.
 */
var LOOKBACK = 'newer_than:3d';

/** The website refuses more than 50 messages in one call. */
var MAX_MESSAGES_PER_RUN = 50;

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
 * is not relied on: the banks are searched by sender domain as well, so a
 * missing, mistyped, or outgrown Gmail filter cannot silently stop the
 * automation.
 *
 * Bank of America is here because leaving it out stopped the automation once
 * already. Its alerts come from ealerts.bankofamerica.com, which "from:" also
 * matches, and it changed its subject line from "You received money with
 * Zelle" to "<name> sent you $24.00". Any filter written against the old
 * wording quietly stopped labelling anything. Matching the sender instead of
 * the subject does not care what the bank calls its emails.
 */
var ALERT_QUERIES = [
  'label:' + ZELLE_LABEL,
  'from:bankofamerica.com',
  'from:wellsfargo.com',
  'from:zellepay.com OR from:zelle.com',
  // Venmo's "<name> paid you $x" notifications. Push this line to Google
  // only AFTER the website that reads Venmo emails is deployed: an email
  // the site cannot read is stored once and never looked at again.
  'from:venmo.com',
  // The Venmo account belongs to a committee member, so its notifications
  // land in her inbox and reach this one by forwarding. A forwarded email
  // carries HER address as the sender, not venmo.com, and the line above
  // never finds it. These two find it by what it says instead of who sent
  // it: the subject Venmo always uses, and the word Venmo anywhere in it.
  'subject:"paid you"',
  'venmo'
];

/** Cheap check before relaying, so statements and marketing are not sent over. */
function looksLikeZelleAlert_(subject, body) {
  return /zelle|venmo|sent you|paid you|received money|payment received|you received/i.test(subject + '\n' + body);
}

/**
 * Threads matching any alert query inside the lookback window, each thread
 * once. Deliberately does not exclude the processed label: that label sits on
 * the thread, not the message, so excluding it hid later alerts that Gmail
 * had grouped into an already-handled thread. The website removes repeats.
 */
function findAlertThreads_() {
  var seen = {};
  var out = [];
  ALERT_QUERIES.forEach(function (q) {
    // in:anywhere looks in Spam and Trash too. A Venmo notification that
    // reaches this inbox by forwarding is exactly the kind of mail Gmail
    // likes to file as spam, and a payment sitting in Spam is still a
    // payment. The website drops anything it has seen and anything that
    // is not a payment, so the wider net costs nothing.
    var threads = GmailApp.search('(' + q + ') -from:me in:anywhere ' + LOOKBACK, 0, MAX_THREADS_PER_RUN);
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
    var threads = findAlertThreads_();
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
      console.log('Checked ' + threads.length + ' thread(s), none looked like a Zelle alert.');
      return;
    }

    // Oldest first, so a busy window can never starve the earliest payment,
    // and never more than the website will accept in one call. Anything over
    // the cap is picked up by the next run, which is five minutes away.
    messages.sort(function (a, b) { return a.received_at < b.received_at ? -1 : 1; });
    var held = Math.max(0, messages.length - MAX_MESSAGES_PER_RUN);
    if (held > 0) messages = messages.slice(0, MAX_MESSAGES_PER_RUN);

    var response = UrlFetchApp.fetch(cfg.url + '/api/payments/inbound', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + cfg.secret },
      payload: JSON.stringify({ messages: messages }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      console.error('Relay failed: HTTP ' + response.getResponseCode() + ' ' + response.getContentText().substring(0, 500));
      return; // the next run offers the same messages again
    }

    // Marks what has been handled so a person reading the mailbox can see it.
    // Nothing depends on this label any more: the search above ignores it and
    // the website is what decides whether a message is new.
    threads.forEach(function (thread) { thread.addLabel(processed); });
    console.log('Relayed ' + messages.length + ' message(s)' +
      (skipped ? ', skipped ' + skipped : '') +
      (held ? ', ' + held + ' held for the next run' : '') +
      ': ' + response.getContentText().substring(0, 800));
  } finally {
    lock.releaseLock();
  }
}

/**
 * Diagnostic. Run it by hand to see which bank or Zelle emails this mailbox
 * holds, which labels they carry, and whether the relay would pick them up.
 */
function listRecentBankEmails() {
  var threads = GmailApp.search('(from:bankofamerica.com OR from:wellsfargo.com OR from:zellepay.com OR from:zelle.com OR label:' + ZELLE_LABEL + ') newer_than:30d', 0, 20);
  if (threads.length === 0) {
    console.log('No email from Bank of America, Wells Fargo or Zelle in the last 30 days in this mailbox. ' +
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
  var threads = GmailApp.search('(from:bankofamerica.com OR from:wellsfargo.com OR from:zellepay.com OR from:zelle.com OR label:' + ZELLE_LABEL + ') newer_than:60d', 0, 10);
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

/**
 * Diagnostic. Pick this function in the editor's dropdown, press Run, and
 * read the Execution log. It answers one question: why a Venmo email that
 * the Gmail search box can see is not found by the relay's search.
 *
 * It runs the Venmo searches with and without the "-from:me" that the relay
 * adds, and prints what "me" means on this account: the signed-in address
 * and every alias Gmail treats as the account's own. If a committee
 * member's address appears among the aliases, her forwarded Venmo emails
 * count as "from me" and the relay has been throwing them away.
 */
function diagnoseVenmo() {
  console.log('Signed in as: ' + Session.getEffectiveUser().getEmail());
  console.log('Aliases Gmail treats as "me": ' + JSON.stringify(GmailApp.getAliases()));
  var queries = [
    'from:venmo.com',
    'subject:"paid you"',
    'venmo'
  ];
  queries.forEach(function (q) {
    [' in:anywhere ', ' -from:me in:anywhere '].forEach(function (extra) {
      var full = '(' + q + ')' + extra + LOOKBACK;
      var threads = GmailApp.search(full, 0, MAX_THREADS_PER_RUN);
      console.log('--- ' + full + ' -> ' + threads.length + ' thread(s)');
      threads.forEach(function (t) {
        t.getMessages().forEach(function (m) {
          var subject = m.getSubject();
          var passes = looksLikeZelleAlert_(subject, m.getPlainBody().substring(0, MAX_BODY_CHARS));
          console.log('    ' + m.getDate().toISOString().slice(0, 16) +
            ' | from: ' + m.getFrom() +
            ' | to: ' + m.getTo() +
            ' | ' + subject.substring(0, 60) +
            ' | relay filter: ' + (passes ? 'PASS' : 'skip'));
        });
      });
    });
  });
}
