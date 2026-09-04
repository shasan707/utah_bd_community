/**
 * BPAU Zelle relay.
 *
 * The only job of this script: every few minutes, take the bank's Zelle alert
 * emails that carry the BPAU-Zelle label and hand them to the website, which
 * does the matching, the confirming, the receipts, and the audit log.
 *
 * No web app, no spreadsheet, no mail sending. Setup: see SETUP.md.
 *
 * Script Properties (Project Settings > Script Properties):
 *   WEBSITE_URL     e.g. https://uthahbdcommunity.vercel.app
 *   INBOUND_SECRET  the same value as ZELLE_INBOUND_SECRET on Vercel
 */

var ZELLE_LABEL = 'BPAU-Zelle';
var PROCESSED_LABEL = 'BPAU-Zelle-Processed';
var MAX_THREADS_PER_RUN = 20;
var MAX_BODY_CHARS = 40000;

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

/** Run once after setting the Script Properties. Re-run to change the interval. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('relayZelleEmails').timeBased().everyMinutes(5).create();
  console.log('Trigger installed: relayZelleEmails every 5 minutes');
}

/** Run once to check the website URL and the secret without touching Gmail. */
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
}
