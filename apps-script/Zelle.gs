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

/** Runs on the timer. Safe to run twice: the website ignores emails it has seen. */
function relayZelleEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var cfg = config_();
    var processed = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
    var threads = GmailApp.search('label:' + ZELLE_LABEL + ' -label:' + PROCESSED_LABEL, 0, MAX_THREADS_PER_RUN);
    if (threads.length === 0) return;

    var messages = [];
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        messages.push({
          message_id: msg.getId(),
          received_at: msg.getDate().toISOString(),
          subject: msg.getSubject(),
          body: msg.getPlainBody().substring(0, MAX_BODY_CHARS)
        });
      });
    });

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
    console.log('Relayed ' + messages.length + ' message(s): ' + response.getContentText().substring(0, 800));
  } finally {
    lock.releaseLock();
  }
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
