/**
 * BPAU Zelle Registration & Payment System (client spec v1)
 * Google Apps Script + Google Sheets + Gmail. Zero cost, manual fallback everywhere.
 *
 * One-time setup: run initSheet(), then installTriggers(). See SETUP.md.
 */

var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0 O 1 I L
var ZELLE_LABEL = 'BPAU-Zelle';
var PROCESSED_LABEL = 'BPAU-Zelle-Processed';

var TABS = {
  Registrations: [
    'code', 'created_at', 'name', 'phone', 'email', 'adults', 'children',
    'ticket_type', 'coupons_qty', 'donation', 'comment', 'amount_due',
    'status', 'payment_method', 'amount_received', 'paid_at',
    'zelle_confirmation_id', 'zelle_sender_name', 'receipt_sent_at',
    'created_by', 'announcements_opt_in', 'notes'
  ],
  Payments: [
    'confirmation_id', 'received_at', 'sender_name', 'amount', 'memo_raw',
    'memo_normalized', 'extracted_code', 'match_status', 'linked_code',
    'suggested_code', 'processed_at'
  ],
  RawEmails: ['message_id', 'received_at', 'subject', 'body_plain', 'parsed'],
  Pricing: ['key', 'value'],
  AuditLog: ['timestamp', 'actor', 'action', 'entity_code', 'before', 'after', 'note']
};

var DEFAULT_PRICING = [
  ['event_name', 'BPAU Eid Reunion 2026'],
  ['event_date', '2026-10-18'],
  ['registration_closes', '2026-10-11'],
  ['price_adult', 25],
  ['price_child', 10],
  ['price_student', 15],
  ['coupon_single', 2],
  ['coupon_bundle_qty', 10],
  ['coupon_bundle_price', 18],
  ['zelle_recipient', 'bpau.pay@gmail.com'],
  ['zelle_recipient_name', 'Qudrat E Alahy Ratul'],
  ['poll_interval_minutes', 5],
  ['contact_email', 'bpau.pay@gmail.com'],
  ['admin_emails', 'bpau.pay@gmail.com'],
  ['log_only', 'TRUE'],
  ['pending_expiry_hours', 72]
];

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

function initSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('BPAU Payments');
    props.setProperty('SHEET_ID', ss.getId());
  }
  Object.keys(TABS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(TABS[name]);
      sheet.setFrozenRows(1);
    }
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  var pricing = ss.getSheetByName('Pricing');
  if (pricing.getLastRow() < 2) {
    DEFAULT_PRICING.forEach(function (row) { pricing.appendRow(row); });
  }
  Logger.log('Sheet ready: ' + ss.getUrl());
  return ss.getUrl();
}

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  var interval = Number(getPricing_().poll_interval_minutes) || 5;
  if ([1, 5, 10, 15, 30].indexOf(interval) === -1) interval = 5;
  ScriptApp.newTrigger('pollZelleEmails').timeBased().everyMinutes(interval).create();
  ScriptApp.newTrigger('dailyMaintenance').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Triggers installed: poll every ' + interval + ' min, maintenance daily 3am');
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Run initSheet() first');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) { return ss_().getSheetByName(name); }

function readRows_(name) {
  var sheet = sheet_(name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _row: i + 1 };
    headers.forEach(function (h, c) { obj[h] = values[i][c]; });
    rows.push(obj);
  }
  return rows;
}

function appendRow_(name, obj) {
  var headers = TABS[name];
  sheet_(name).appendRow(headers.map(function (h) {
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  }));
}

function updateRow_(name, rowIndex, patch) {
  var headers = TABS[name];
  var sheet = sheet_(name);
  Object.keys(patch).forEach(function (key) {
    var col = headers.indexOf(key);
    if (col >= 0) sheet.getRange(rowIndex, col + 1).setValue(patch[key]);
  });
}

function getPricing_() {
  var out = {};
  readRows_('Pricing').forEach(function (r) { out[String(r.key).trim()] = r.value; });
  return out;
}

function audit_(actor, action, entityCode, before, after, note) {
  appendRow_('AuditLog', {
    timestamp: new Date(),
    actor: actor || 'system',
    action: action,
    entity_code: entityCode || '',
    before: before ? JSON.stringify(before) : '',
    after: after ? JSON.stringify(after) : '',
    note: note || ''
  });
}

/* ------------------------------------------------------------------ */
/* Pricing math + codes                                                */
/* ------------------------------------------------------------------ */

function couponCost(qty, p) {
  var bundleQty = Number(p.coupon_bundle_qty) || 10;
  var bundles = Math.floor(qty / bundleQty);
  var singles = qty % bundleQty;
  return bundles * Number(p.coupon_bundle_price) + singles * Number(p.coupon_single);
}

function computeAmount_(reg, p) {
  var adultPrice = reg.ticket_type === 'student' ? Number(p.price_student) : Number(p.price_adult);
  return reg.adults * adultPrice +
    reg.children * Number(p.price_child) +
    couponCost(reg.coupons_qty, p) +
    reg.donation;
}

function codeExists_(code) {
  return readRows_('Registrations').some(function (r) { return r.code === code; });
}

function generateCode(prefix) {
  for (var attempt = 0; attempt < 20; attempt++) {
    var body = '';
    for (var i = 0; i < 4; i++) {
      body += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }
    var code = prefix + '-' + body;
    if (!codeExists_(code)) return code;
  }
  throw new Error('Could not generate unique code');
}

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'form';
  if (page === 'admin') {
    var email = Session.getActiveUser().getEmail();
    if (!isAdmin_(email)) {
      return HtmlService.createHtmlOutput(
        '<p style="font-family:sans-serif">Not authorized' +
        (email ? ' (' + email + ')' : '') +
        '. Ask the treasurer to add your Google account to admin_emails in the Pricing tab.</p>');
    }
    var admin = HtmlService.createTemplateFromFile('Admin');
    admin.adminEmail = email;
    return admin.evaluate().setTitle('BPAU Admin').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  var t = HtmlService.createTemplateFromFile('Form');
  var p = getPricing_();
  t.pricingJson = JSON.stringify({
    event_name: p.event_name,
    event_date: fmtDate_(p.event_date),
    registration_closes: fmtDate_(p.registration_closes),
    price_adult: Number(p.price_adult),
    price_child: Number(p.price_child),
    price_student: Number(p.price_student),
    coupon_single: Number(p.coupon_single),
    coupon_bundle_qty: Number(p.coupon_bundle_qty),
    coupon_bundle_price: Number(p.coupon_bundle_price),
    zelle_recipient: p.zelle_recipient,
    zelle_recipient_name: p.zelle_recipient_name,
    contact_email: p.contact_email
  });
  return t.evaluate()
    .setTitle('BPAU Registration')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Called from Form.html. The amount is ALWAYS computed server-side. */
function submitRegistration(data) {
  var p = getPricing_();
  if (new Date() > closesAt_(p.registration_closes)) {
    throw new Error('Registration is closed.');
  }

  var reg = {
    name: String(data.name || '').trim(),
    phone: String(data.phone || '').replace(/\D/g, ''),
    email: String(data.email || '').trim().toLowerCase(),
    adults: clampInt_(data.adults, 0, 50),
    children: clampInt_(data.children, 0, 50),
    ticket_type: data.ticket_type === 'student' ? 'student' : 'professional',
    coupons_qty: clampInt_(data.coupons_qty, 0, 500),
    donation: Math.max(0, Math.round(Number(data.donation || 0) * 100) / 100),
    comment: String(data.comment || '').trim(),
    announcements_opt_in: data.announcements ? 'yes' : 'no'
  };
  if (!reg.name) throw new Error('Name is required.');
  if (!reg.phone) throw new Error('Phone is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reg.email)) throw new Error('A valid email is required.');
  if (reg.adults + reg.children + reg.coupons_qty === 0 && reg.donation === 0) {
    throw new Error('Nothing selected.');
  }

  var amount = computeAmount_(reg, p);
  if (amount <= 0) throw new Error('Amount is zero.');

  // One code per payment. Prefix by what the payment is mostly for.
  var prefix = 'R';
  if (reg.adults + reg.children === 0) prefix = reg.coupons_qty > 0 ? 'C' : 'D';
  var code = generateCode(prefix);

  appendRow_('Registrations', {
    code: code,
    created_at: new Date(),
    name: reg.name,
    phone: reg.phone,
    email: reg.email,
    adults: reg.adults,
    children: reg.children,
    ticket_type: reg.ticket_type,
    coupons_qty: reg.coupons_qty,
    donation: reg.donation,
    comment: reg.comment,
    amount_due: amount,
    status: 'PENDING',
    created_by: 'web',
    announcements_opt_in: reg.announcements_opt_in
  });
  audit_('system', 'REGISTRATION_CREATED', code, null, { amount_due: amount, email: reg.email });

  sendPendingEmail_(code, reg, amount, p);

  return {
    code: code,
    amount: money_(amount),
    zelle_recipient: p.zelle_recipient,
    zelle_recipient_name: p.zelle_recipient_name,
    breakdown: breakdownLines_(reg, p)
  };
}

function clampInt_(v, min, max) {
  var n = Math.floor(Number(v || 0));
  if (isNaN(n)) n = 0;
  return Math.max(min, Math.min(max, n));
}

function money_(n) { return '$' + Number(n).toFixed(2); }

/** Formats a Pricing date (Date object or yyyy-mm-dd text) as "Oct 18, 2026". */
function fmtDate_(v) {
  var d = v instanceof Date ? v : new Date(String(v) + 'T12:00:00');
  if (isNaN(d.getTime())) return String(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d, yyyy');
}

/** End-of-day cutoff for registration_closes, whether stored as Date or text. */
function closesAt_(v) {
  var d = v instanceof Date ? new Date(v.getTime()) : new Date(String(v) + 'T12:00:00');
  if (isNaN(d.getTime())) return new Date('2100-01-01');
  d.setHours(23, 59, 59, 999);
  return d;
}

function breakdownLines_(reg, p) {
  var lines = [];
  var adultPrice = reg.ticket_type === 'student' ? Number(p.price_student) : Number(p.price_adult);
  var label = reg.ticket_type === 'student' ? 'student' : 'adult';
  if (reg.adults > 0) lines.push(reg.adults + ' ' + label + (reg.adults > 1 ? 's' : '') + ' @ ' + money_(adultPrice) + ' = ' + money_(reg.adults * adultPrice));
  if (reg.children > 0) lines.push(reg.children + ' child' + (reg.children > 1 ? 'ren' : '') + ' @ ' + money_(Number(p.price_child)) + ' = ' + money_(reg.children * Number(p.price_child)));
  if (reg.coupons_qty > 0) lines.push(reg.coupons_qty + ' coupons = ' + money_(couponCost(reg.coupons_qty, p)));
  if (reg.donation > 0) lines.push('Donation = ' + money_(reg.donation));
  return lines;
}

/* ------------------------------------------------------------------ */
/* Emails to members                                                   */
/* ------------------------------------------------------------------ */

function sendPendingEmail_(code, reg, amount, p) {
  var subject = 'BPAU - your code ' + code + ' (' + money_(amount) + ')';
  var body =
    'Assalamu alaikum ' + reg.name + ',\n\n' +
    'Your registration for ' + p.event_name + ' is saved.\n\n' +
    'Your code:  ' + code + '\n' +
    'Amount:     ' + money_(amount) + '\n\n' +
    breakdownLines_(reg, p).map(function (l) { return '  ' + l; }).join('\n') + '\n\n' +
    'Send ' + money_(amount) + ' via Zelle to:\n' +
    '  ' + p.zelle_recipient + '\n' +
    '  (' + p.zelle_recipient_name + ')\n\n' +
    'IMPORTANT: put ' + code + ' in the Zelle memo/note field.\n\n' +
    'You will get a receipt by email once we confirm the payment.\n' +
    'Questions? Reply to this email or write to ' + p.contact_email + '.\n\n' +
    'BPAU';
  MailApp.sendEmail(reg.email, subject, body, { name: 'BPAU', replyTo: String(p.contact_email) });
}

function sendReceipt_(regRow, p) {
  var reg = {
    adults: Number(regRow.adults), children: Number(regRow.children),
    ticket_type: regRow.ticket_type, coupons_qty: Number(regRow.coupons_qty),
    donation: Number(regRow.donation)
  };
  var subject = 'BPAU - Payment confirmed (' + regRow.code + ')';
  var body =
    'BPAU - Payment confirmed\n\n' +
    'Receipt:  ' + regRow.code + '\n' +
    'Date:     ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy') + '\n' +
    'Name:     ' + regRow.name + '\n' +
    'Paid:     ' + money_(regRow.amount_received) + ' via ' + (regRow.payment_method || 'zelle') + '\n\n' +
    breakdownLines_(reg, p).map(function (l) { return '  ' + l; }).join('\n') + '\n' +
    '  Total = ' + money_(regRow.amount_due) + '\n\n' +
    'Event:  ' + p.event_name + '\n' +
    'Date:   ' + fmtDate_(p.event_date) + '\n\n' +
    'Bring this email or your name to the check-in desk.\n\nBPAU';
  MailApp.sendEmail(regRow.email, subject, body, { name: 'BPAU', replyTo: String(p.contact_email) });
}

function notifyAdmins_(subject, body) {
  var emails = String(getPricing_().admin_emails || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (emails.length) MailApp.sendEmail(emails.join(','), '[BPAU system] ' + subject, body);
}

/* ------------------------------------------------------------------ */
/* Zelle email parsing                                                 */
/* ------------------------------------------------------------------ */

function parseZelleEmail(body) {
  var amount = body.match(/sent you \$([\d,]+\.\d{2})/);
  var sender = body.match(/^(.+?)\s+sent you \$/m);
  var confirm = body.match(/Confirmation:\s*(\S+)/i);
  var memo = body.match(/Memo:\s*(.+)/i);
  if (!amount || !confirm) return null; // not a Zelle receipt
  return {
    amount: parseFloat(amount[1].replace(/,/g, '')),
    sender_name: sender ? sender[1].trim() : '',
    confirmation: confirm[1].trim(),
    memo_raw: memo ? memo[1].trim() : ''
  };
}

function extractCandidates(memo) {
  var clean = String(memo).toUpperCase().replace(/[^A-Z0-9]/g, '');
  var found = clean.match(/[RCD][23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}/g) || [];
  var bare = clean.match(/[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}/g) || [];
  var set = {};
  found.concat(bare).forEach(function (c) { set[c] = true; });
  return Object.keys(set);
}

function pollZelleEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var processedLabel = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
    var threads = GmailApp.search('label:' + ZELLE_LABEL + ' -label:' + PROCESSED_LABEL);
    var known = {};
    readRows_('RawEmails').forEach(function (r) { known[r.message_id] = true; });

    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (msg) {
        var msgId = msg.getId();
        if (known[msgId]) return;
        var body = msg.getPlainBody();
        appendRow_('RawEmails', {
          message_id: msgId,
          received_at: msg.getDate(),
          subject: msg.getSubject(),
          body_plain: body.substring(0, 40000),
          parsed: false
        });
        known[msgId] = true;
        var parsed = parseZelleEmail(body);
        if (!parsed) return;
        markRawParsed_(msgId);
        recordPayment_(parsed, msg.getDate());
      });
      thread.addLabel(processedLabel);
    });

    if (String(getPricing_().log_only).toUpperCase() !== 'TRUE') {
      applyMatchedPayments();
    }
  } finally {
    lock.releaseLock();
  }
}

function markRawParsed_(msgId) {
  var rows = readRows_('RawEmails');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].message_id === msgId) {
      updateRow_('RawEmails', rows[i]._row, { parsed: true });
      return;
    }
  }
}

function recordPayment_(parsed, receivedAt) {
  var payments = readRows_('Payments');
  var duplicate = payments.some(function (row) { return row.confirmation_id === parsed.confirmation; });

  var normalized = String(parsed.memo_raw).toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  var record = {
    confirmation_id: parsed.confirmation,
    received_at: receivedAt,
    sender_name: parsed.sender_name,
    amount: parsed.amount,
    memo_raw: parsed.memo_raw,
    memo_normalized: normalized,
    extracted_code: '',
    match_status: 'UNMATCHED',
    linked_code: '',
    suggested_code: '',
    processed_at: ''
  };

  if (duplicate) {
    record.match_status = 'DUPLICATE';
    appendRow_('Payments', record);
    return;
  }

  var pending = readRows_('Registrations').filter(function (r) { return r.status === 'PENDING'; });
  var candidates = extractCandidates(parsed.memo_raw);
  var matches = [];
  pending.forEach(function (reg) {
    var full = String(reg.code).replace('-', '');
    var bare = full.substring(1);
    if (candidates.indexOf(full) >= 0 || candidates.indexOf(bare) >= 0) matches.push(reg);
  });

  if (matches.length === 1) {
    var reg = matches[0];
    record.extracted_code = reg.code;
    record.linked_code = reg.code;
    var due = Math.round(Number(reg.amount_due) * 100);
    var got = Math.round(parsed.amount * 100);
    record.match_status = got >= due ? 'MATCHED' : 'AMOUNT_MISMATCH';
    if (got < due) {
      notifyAdmins_('Amount mismatch on ' + reg.code,
        reg.name + ' owes ' + money_(reg.amount_due) + ' but sent ' + money_(parsed.amount) +
        ' (confirmation ' + parsed.confirmation + '). No receipt sent. Resolve in the admin panel.');
    }
  } else if (matches.length > 1) {
    record.match_status = 'UNMATCHED';
    record.extracted_code = matches.map(function (m) { return m.code; }).join(' ');
  } else {
    // Fuzzy: same amount + overlapping name tokens. Suggest only, never auto-confirm.
    var senderTokens = String(parsed.sender_name).toUpperCase().split(/\s+/).filter(Boolean);
    var hits = pending.filter(function (reg) {
      if (Math.round(Number(reg.amount_due) * 100) !== Math.round(parsed.amount * 100)) return false;
      var nameTokens = String(reg.name).toUpperCase().split(/\s+/);
      return senderTokens.some(function (t) { return nameTokens.indexOf(t) >= 0; });
    });
    if (hits.length === 1) record.suggested_code = hits[0].code;
  }

  appendRow_('Payments', record);
}

/** Applies MATCHED payments that have not been processed yet. Safe to re-run. */
function applyMatchedPayments() {
  var p = getPricing_();
  var payments = readRows_('Payments');
  var regs = readRows_('Registrations');
  payments.forEach(function (pay) {
    if (pay.match_status !== 'MATCHED' || pay.processed_at) return;
    var reg = null;
    for (var i = 0; i < regs.length; i++) {
      if (regs[i].code === pay.linked_code) { reg = regs[i]; break; }
    }
    if (!reg || reg.status !== 'PENDING') {
      updateRow_('Payments', pay._row, { processed_at: new Date() });
      return;
    }
    var overpaid = Math.round(Number(pay.amount) * 100) > Math.round(Number(reg.amount_due) * 100);
    updateRow_('Registrations', reg._row, {
      status: 'PAID',
      payment_method: 'zelle',
      amount_received: pay.amount,
      paid_at: pay.received_at,
      zelle_confirmation_id: pay.confirmation_id,
      zelle_sender_name: pay.sender_name,
      receipt_sent_at: new Date(),
      notes: overpaid ? String(reg.notes || '') + ' [OVERPAID by ' + money_(pay.amount - reg.amount_due) + ']' : reg.notes
    });
    updateRow_('Payments', pay._row, { processed_at: new Date() });
    reg.amount_received = pay.amount;
    reg.payment_method = 'zelle';
    sendReceipt_(reg, p);
    audit_('system', 'AUTO_CONFIRMED', reg.code, { status: 'PENDING' },
      { status: 'PAID', amount_received: pay.amount, confirmation: pay.confirmation_id },
      overpaid ? 'overpaid' : '');
    if (overpaid) {
      notifyAdmins_('Overpayment on ' + reg.code,
        reg.name + ' owed ' + money_(reg.amount_due) + ' but sent ' + money_(pay.amount) + '. Marked PAID; decide on the difference.');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                         */
/* ------------------------------------------------------------------ */

function dailyMaintenance() {
  var p = getPricing_();
  var expiryHours = Number(p.pending_expiry_hours) || 72;
  var cutoff = new Date(Date.now() - expiryHours * 3600 * 1000);

  readRows_('Registrations').forEach(function (reg) {
    if (reg.status === 'PENDING' && new Date(reg.created_at) < cutoff) {
      updateRow_('Registrations', reg._row, { status: 'EXPIRED' });
      audit_('system', 'AUTO_EXPIRED', reg.code, { status: 'PENDING' }, { status: 'EXPIRED' }, expiryHours + 'h unpaid');
    }
  });

  // Dead-man's switch: registration window open but no email seen in 24h.
  var closes = new Date(String(p.registration_closes) + 'T23:59:59');
  if (new Date() <= closes) {
    var dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    var recent = readRows_('RawEmails').some(function (r) { return new Date(r.received_at) > dayAgo; });
    if (!recent) {
      notifyAdmins_('Heartbeat: no Zelle emails in 24h',
        'Registration is open but the parser has seen no forwarded emails in 24 hours.\n' +
        'Check: Gmail forwarding from the Wells Fargo alert inbox, the ' + ZELLE_LABEL + ' label filter, and the trigger.');
    }
  }

  // Totals reconciliation.
  var paySum = 0;
  readRows_('Payments').forEach(function (r) {
    if (r.match_status === 'MATCHED' && r.processed_at) paySum += Number(r.amount) || 0;
  });
  var regSum = 0;
  readRows_('Registrations').forEach(function (r) {
    if (r.status === 'PAID' && r.payment_method === 'zelle') regSum += Number(r.amount_received) || 0;
  });
  if (Math.round(paySum * 100) !== Math.round(regSum * 100)) {
    notifyAdmins_('Totals drift detected',
      'Zelle payments applied: ' + money_(paySum) + '\nRegistrations marked PAID via zelle: ' + money_(regSum) +
      '\nInvestigate the Payments and Registrations tabs.');
  }
}

/* ------------------------------------------------------------------ */
/* Admin panel backend (every mutation writes AuditLog)                */
/* ------------------------------------------------------------------ */

function isAdmin_(email) {
  if (!email) return false;
  var admins = String(getPricing_().admin_emails || '').toLowerCase().split(',').map(function (s) { return s.trim(); });
  return admins.indexOf(email.toLowerCase()) >= 0;
}

function requireAdmin_() {
  var email = Session.getActiveUser().getEmail();
  if (!isAdmin_(email)) throw new Error('Not authorized');
  return email;
}

function adminData() {
  requireAdmin_();
  var regs = readRows_('Registrations');
  var pays = readRows_('Payments');
  var now = Date.now();
  return {
    pending: regs.filter(function (r) { return r.status === 'PENDING'; }).map(function (r) {
      return {
        code: r.code, name: r.name, email: r.email, phone: r.phone,
        amount_due: Number(r.amount_due),
        age_hours: Math.round((now - new Date(r.created_at).getTime()) / 3600000),
        stale: (now - new Date(r.created_at).getTime()) > 48 * 3600000
      };
    }),
    unmatched: pays.filter(function (r) { return r.match_status === 'UNMATCHED'; }).map(function (r) {
      return {
        confirmation_id: r.confirmation_id, sender_name: r.sender_name,
        amount: Number(r.amount), memo_raw: r.memo_raw, suggested_code: r.suggested_code
      };
    }),
    mismatches: pays.filter(function (r) { return r.match_status === 'AMOUNT_MISMATCH' && !r.processed_at; }).map(function (r) {
      var reg = null;
      for (var i = 0; i < regs.length; i++) if (regs[i].code === r.linked_code) reg = regs[i];
      return {
        confirmation_id: r.confirmation_id, code: r.linked_code,
        expected: reg ? Number(reg.amount_due) : null, received: Number(r.amount), name: reg ? reg.name : ''
      };
    }),
    all: regs.map(function (r) {
      return {
        code: r.code, name: r.name, email: r.email, phone: r.phone,
        adults: r.adults, children: r.children, coupons_qty: r.coupons_qty,
        donation: r.donation, amount_due: Number(r.amount_due), status: r.status,
        payment_method: r.payment_method, amount_received: r.amount_received
      };
    }),
    log_only: String(getPricing_().log_only).toUpperCase() === 'TRUE'
  };
}

function findReg_(code) {
  var regs = readRows_('Registrations');
  for (var i = 0; i < regs.length; i++) if (regs[i].code === code) return regs[i];
  throw new Error('Code not found: ' + code);
}

function adminMarkPaid(code, method, amount, note) {
  var actor = requireAdmin_();
  var reg = findReg_(code);
  var before = { status: reg.status };
  var amt = Number(amount) || Number(reg.amount_due);
  updateRow_('Registrations', reg._row, {
    status: 'PAID', payment_method: method || 'cash', amount_received: amt,
    paid_at: new Date(), receipt_sent_at: new Date(),
    notes: note ? String(reg.notes || '') + ' ' + note : reg.notes
  });
  reg.amount_received = amt;
  reg.payment_method = method || 'cash';
  sendReceipt_(reg, getPricing_());
  audit_(actor, 'MARK_PAID', code, before, { status: 'PAID', method: method, amount: amt }, note);
  return 'Marked ' + code + ' paid (' + money_(amt) + ' ' + (method || 'cash') + '), receipt sent.';
}

function adminLinkPayment(confirmationId, code) {
  var actor = requireAdmin_();
  var pays = readRows_('Payments');
  var pay = null;
  for (var i = 0; i < pays.length; i++) if (pays[i].confirmation_id === confirmationId) pay = pays[i];
  if (!pay) throw new Error('Payment not found');
  var reg = findReg_(code);
  updateRow_('Payments', pay._row, { match_status: 'MATCHED', linked_code: code, processed_at: '' });
  audit_(actor, 'LINK_PAYMENT', code, { match_status: pay.match_status }, { match_status: 'MATCHED', confirmation: confirmationId }, '');
  applyMatchedPayments();
  return 'Linked ' + confirmationId + ' to ' + code + '.';
}

function adminResolveMismatch(code, decision, note) {
  var actor = requireAdmin_();
  var reg = findReg_(code);
  var pays = readRows_('Payments');
  var pay = null;
  for (var i = 0; i < pays.length; i++) {
    if (pays[i].linked_code === code && pays[i].match_status === 'AMOUNT_MISMATCH') pay = pays[i];
  }
  if (decision === 'accept') {
    updateRow_('Registrations', reg._row, {
      status: 'PAID', payment_method: 'zelle', amount_received: pay ? pay.amount : reg.amount_due,
      paid_at: new Date(), receipt_sent_at: new Date(),
      zelle_confirmation_id: pay ? pay.confirmation_id : '',
      notes: String(reg.notes || '') + ' [mismatch accepted] ' + (note || '')
    });
    if (pay) updateRow_('Payments', pay._row, { processed_at: new Date() });
    reg.amount_received = pay ? pay.amount : reg.amount_due;
    reg.payment_method = 'zelle';
    sendReceipt_(reg, getPricing_());
    audit_(actor, 'MISMATCH_ACCEPTED', code, null, { amount: pay ? pay.amount : null }, note);
    return 'Accepted the received amount for ' + code + ', receipt sent.';
  }
  audit_(actor, 'MISMATCH_NOTED', code, null, null, note);
  return 'Noted. Ask the member for the difference, then Mark Paid.';
}

function adminCreateEntry(data, markPaidNow, method) {
  var actor = requireAdmin_();
  var p = getPricing_();
  var reg = {
    name: String(data.name || '').trim(),
    phone: String(data.phone || '').replace(/\D/g, ''),
    email: String(data.email || '').trim().toLowerCase(),
    adults: clampInt_(data.adults, 0, 50),
    children: clampInt_(data.children, 0, 50),
    ticket_type: data.ticket_type === 'student' ? 'student' : 'professional',
    coupons_qty: clampInt_(data.coupons_qty, 0, 500),
    donation: Math.max(0, Number(data.donation || 0)),
    comment: 'created by admin',
    announcements_opt_in: 'no'
  };
  if (!reg.name) throw new Error('Name required');
  var amount = computeAmount_(reg, p);
  var prefix = reg.adults + reg.children === 0 ? (reg.coupons_qty > 0 ? 'C' : 'D') : 'R';
  var code = generateCode(prefix);
  appendRow_('Registrations', {
    code: code, created_at: new Date(), name: reg.name, phone: reg.phone,
    email: reg.email, adults: reg.adults, children: reg.children,
    ticket_type: reg.ticket_type, coupons_qty: reg.coupons_qty, donation: reg.donation,
    comment: reg.comment, amount_due: amount, status: 'PENDING',
    created_by: actor, announcements_opt_in: 'no'
  });
  audit_(actor, 'ADMIN_CREATED', code, null, { amount_due: amount }, 'walk-in/phone entry');
  if (markPaidNow) return adminMarkPaid(code, method || 'cash', amount, 'paid at creation');
  if (reg.email) sendPendingEmail_(code, reg, amount, p);
  return 'Created ' + code + ' for ' + money_(amount) + ' (PENDING).';
}

function adminAdjustAmount(code, newAmount, note) {
  var actor = requireAdmin_();
  var reg = findReg_(code);
  var before = { amount_due: reg.amount_due };
  updateRow_('Registrations', reg._row, { amount_due: Number(newAmount) });
  audit_(actor, 'ADJUST_AMOUNT', code, before, { amount_due: Number(newAmount) }, note || '');
  return 'Amount for ' + code + ' set to ' + money_(newAmount) + '.';
}

function adminVoid(code, reason) {
  var actor = requireAdmin_();
  if (!reason) throw new Error('A reason is required.');
  var reg = findReg_(code);
  var newStatus = reg.status === 'PAID' ? 'REFUNDED' : 'CANCELLED';
  updateRow_('Registrations', reg._row, { status: newStatus, notes: String(reg.notes || '') + ' [' + newStatus + ': ' + reason + ']' });
  audit_(actor, newStatus, code, { status: reg.status }, { status: newStatus }, reason);
  return code + ' is now ' + newStatus + '.';
}

function adminResendReceipt(code) {
  var actor = requireAdmin_();
  var reg = findReg_(code);
  if (reg.status !== 'PAID') throw new Error(code + ' is not PAID.');
  sendReceipt_(reg, getPricing_());
  audit_(actor, 'RESEND_RECEIPT', code, null, null, '');
  return 'Receipt re-sent for ' + code + '.';
}

function adminMerge(keepCode, dropCode) {
  var actor = requireAdmin_();
  var drop = findReg_(dropCode);
  findReg_(keepCode); // validate
  updateRow_('Registrations', drop._row, {
    status: 'CANCELLED',
    notes: String(drop.notes || '') + ' [merged into ' + keepCode + ']'
  });
  audit_(actor, 'MERGE', keepCode, { dropped: dropCode }, null, 'duplicate merged');
  return dropCode + ' merged into ' + keepCode + '.';
}

function adminExportCsv() {
  requireAdmin_();
  var rows = readRows_('Registrations');
  var headers = TABS.Registrations;
  var lines = [headers.join(',')];
  rows.forEach(function (r) {
    lines.push(headers.map(function (h) {
      var v = r[h] === undefined || r[h] === null ? '' : String(r[h]);
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(','));
  });
  return lines.join('\n');
}

function adminSetLogOnly(value) {
  var actor = requireAdmin_();
  var pricing = readRows_('Pricing');
  for (var i = 0; i < pricing.length; i++) {
    if (String(pricing[i].key).trim() === 'log_only') {
      updateRow_('Pricing', pricing[i]._row, { value: value ? 'TRUE' : 'FALSE' });
      audit_(actor, 'SET_LOG_ONLY', '', null, { log_only: value }, '');
      return 'log_only is now ' + (value ? 'TRUE (parser records but never acts)' : 'FALSE (auto-confirm live)');
    }
  }
  throw new Error('log_only key missing in Pricing tab');
}
