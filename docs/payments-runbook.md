# BPAU Registration and Zelle Payments, Runbook

This is the same process as the first version: members register, get a code
by email, send a Zelle with the code in the memo, the bank's alert email
confirms the payment automatically, and a receipt email goes out. What changed
is where it runs. The website and its database (Supabase) hold the form, the
codes, the matching, the receipts, the admin, and the audit log. The BPAU
Gmail account keeps two quiet jobs only, both done by one small script on a
timer: sending the emails the website queues, and relaying the bank's Zelle
alerts to the website.

If Google ever locks that account again, emails and automatic confirmation
stop, but registrations, codes, and the admin keep working, and you can
confirm payments by hand until it is back.

## How it works

1. A member fills the form at /register. The server saves a PENDING row, gives
   them a short code such as R-7X3M, and queues the code email with the Zelle
   instructions. The Gmail script sends it within about a minute.
2. The member sends the Zelle with the code in the memo.
3. Wells Fargo emails a "sent you $25.00" alert. Every 5 minutes the relay
   script looks for new emails from Wells Fargo or Zelle (or anything
   carrying the BPAU-Zelle label), keeps the ones that read like a Zelle
   alert, and hands them to the website.
4. The website reads the amount, the sender, the confirmation number, and the
   memo, and looks for a code among the unpaid registrations.
   - One code, full amount: matched. With auto-confirm on, the registration
     becomes PAID and the receipt goes out. With auto-confirm off, it waits on
     the Zelle tab for your click.
   - One code, short amount: "amount short". Nothing is confirmed; you decide.
   - No code: "no match". If the amount and the sender's name fit one person,
     that code is suggested. You link it with one click.
   - Same confirmation number twice: recorded as a duplicate, ignored.
5. Codes that stay unpaid for 72 hours expire on their own every night.

## One-time setup

### 1. Database

In the Supabase dashboard open SQL Editor and run, once each and in this order:
`supabase/payments.sql`, then `supabase/payments_zelle.sql`, then
`supabase/payments_email.sql`, then `supabase/payments_email_html.sql` (the
ticket-style emails; until it is run, emails go out as plain text).

Then Authentication, Providers, Email: turn off "Allow new users to sign up".
Anyone who can sign in to /admin can see every registration, so accounts must
be created by hand (Authentication, Users, Add user).

### 2. Server secrets

The site needs these environment variables. Locally they go in `.env.local`.
On Vercel they go in Project Settings, Environment Variables, for Production.
After adding or changing any of them, redeploy.

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, Project Settings, API, service_role key. Never put this in a NEXT_PUBLIC variable. |
| `CRON_SECRET` | Any long random string. Vercel sends it when it runs the nightly expiry job. |
| `ZELLE_INBOUND_SECRET` | Another long random string. The Gmail relay sends it with every batch of bank emails. |
| `EMAIL_PROVIDER` | `relay`: the Gmail script sends the emails (nothing else to set). `gmail`: the website sends at once through Gmail with an App Password. `resend` or `brevo`: with a verified domain. Leave empty to send no email. |
| `EMAIL_USER` | `gmail` only. The Gmail address that sends, for example `bpau.pay@gmail.com`. |
| `EMAIL_APP_PASSWORD` | `gmail` only. A 16 character App Password from that Gmail account (see step 3). |
| `EMAIL_FROM` | Optional. `BPAU <bpau.pay@gmail.com>`. Only the display name is used with `relay` and `gmail`. |

### 3. Email (the Gmail relay)

Set `EMAIL_PROVIDER=relay` on Vercel and redeploy. That is all. The website
writes each email it wants to send (the code email after the form, the receipt
after confirmation, alerts to the contact email) into the `email_outbox` table,
and the script in the BPAU Gmail (step 4) sends them from that account within
about a minute, exactly as the first version did with MailApp. No App Password
and no 2-Step Verification are needed. The member's screen says "we are
emailing these instructions to you now", and the admin row shows "code email
queued" until the script reports it sent.

A normal Gmail account can send to 100 recipients a day through a script, the
same limit the first version had. If a day's quota runs out, emails wait in
the outbox and go out the next day; the code and the Zelle instructions are
always shown on screen anyway. The admin header shows "Emails waiting" while
anything is queued and "Emails failed" if the script gave up on one (the
reason is in that row's History).

Instant sending instead (optional): with an App Password the website sends
each email itself, up to about 500 a day.

1. Sign in to the BPAU Gmail. Google Account, Security: turn on 2-Step
   Verification. Google no longer needs a phone number for this; choose the
   Google Authenticator app as the second step and scan the code.
2. On the same Security page open "App passwords" (search for it if hidden).
   Create one named "Utah USA website". Google shows a 16 character password
   once. Copy it into `EMAIL_APP_PASSWORD`, set `EMAIL_USER`, and set
   `EMAIL_PROVIDER=gmail`.

Either way, register once on /register with your own email and check the code
email arrives. Mark it paid in the admin and check the receipt arrives. Do not
deploy a web app in that account again; timed scripts and App Passwords are
ordinary uses.

If you later own a domain, Resend is the cleaner option: verify the domain
there, then set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, and `EMAIL_FROM` on
that domain. No code change.

What the two emails look like: the code email is a payment card (the code,
the amount, the three Zelle steps, what the amount covers) and the receipt
is an admission ticket (a greeting, the event name, date, time, and venue,
the ticket holder, who it admits, the ticket number, and what was paid).
Both carry a "track your registration" link to /register/status, where a
member enters the code and their email and sees the three steps: registered,
Zelle received, ticket sent. The same tracker updates by itself on the screen
right after registering.

### 4. The Gmail script (emails out, Zelle alerts in)

Follow `apps-script/SETUP.md`: push `Zelle.gs` and `appsscript.json` to the
existing script project, archive the two old web app deployments, set the two
Script Properties (`WEBSITE_URL`, `INBOUND_SECRET`), set up the Gmail
forwarding and the BPAU-Zelle label filter, run `testConnection`, then run
`installTriggers`. That installs two timers: `sendQueuedEmails` every minute
and `relayZelleEmails` every 5 minutes.

### 5. Zelle recipient and contact email

Nothing to type. These three values are pre-filled with what the first
version used: Zelle recipient `bpau.pay@gmail.com`, the name Zelle shows for
it (`Qudrat E Alahy Ratul`), and `bpau@gmail.com` as the contact email for
replies and alerts. A blank row in the database falls back to the same values.

Change them in Settings on /admin/payments only if the alias enrolled in Zelle
at the bank changes (a phone number, or an address Google cannot lock, is the
safer long-term choice) or if the committee wants replies in another inbox.

### 5b. Event details on the ticket

Settings has an event time and a venue field. Both are blank until you fill
them; the ticket, the tracking page, and the register page show them as soon
as you save. For a new event, change the name, date, time, venue, closing
date, and prices there and every new email carries the new details.

### 6. Turn it on

On /admin/payments, Settings tab: glance at the event name, dates, and prices
(all pre-filled). Leave "Auto-confirm Zelle payments" off for the first week.
Tick "Registration is open" and save. Within a minute the Register buttons
appear on the site.

Registration closes by itself at the end of the "Registration closes" date
(Utah time). Untick "Registration is open" to pause it at any time.

### 7. The first week: log only

With auto-confirm off, every bank alert is recorded and matched on the Zelle
tab but nothing is confirmed until you click. Watch it for about a week:

- Send yourself a real Zelle with a correct code in the memo. Within a few
  minutes the Zelle tab shows it as matched to that code.
- Try a lowercase memo with extra words, such as "for r7x3m please". Still
  matched.
- Try no memo. It shows as "no match" with a suggestion if the name fits.
- Try a short amount. It shows as "amount short".

When a week looks right, tick "Auto-confirm Zelle payments" in Settings.

## Treasurer's daily flow

1. Open /admin/payments. The Overview tab is the dashboard: paid and waiting
   counts with the money collected and expected, people attending and food
   coupons sold, the four-step progress of all registrations (registered,
   code emailed, paid, ticket sent), registrations per day for two weeks,
   a "needs your attention" list that jumps to the right tab, and the recent
   activity. Every registration row also shows its own four steps.
   The header shows when the last bank email arrived.
   If it says "none yet" during an open registration window, run
   `listRecentBankEmails` in the script project (see below).
2. The Zelle tab lists anything that needs a look: payments with no code,
   short amounts, or (with auto-confirm off) matches waiting for a click.
3. The Pending tab lists everyone who has not paid yet, newest first. Rows
   older than two days are outlined.
4. A Zelle that never reached the website (for example an alert that went
   missing) can be typed in with "Record a Zelle by hand"; if the memo carries
   a code it is confirmed at once. Cash at the door goes in through New entry.
5. At the door, use the All registrations tab (search by name or code) or the
   CSV export.

## Every action, explained

- **Mark paid**: PENDING or EXPIRED becomes PAID, receipt goes out. Clicking
  twice does nothing harmful; the second click gets "already PAID".
- **Adjust amount**: changes what is due before payment (discounts, corrections).
- **Void**: a PENDING or EXPIRED row becomes CANCELLED. A PAID row becomes
  REFUNDED. A reason is required. This only records the refund; send the money
  back from the bank yourself.
- **Resend receipt**: sends the receipt again to the email on the row.
- **Merge into**: for duplicate submissions. The row you act on is cancelled
  and noted as merged into the code you keep. Paid rows cannot be merged away.
- **History**: every audit row for that code, plus all the details.
- **New entry**: walk-in or phone registration. Only the name is required. Tick
  "Mark as paid now" for cash at the door.
- **Zelle tab, Link to a code**: tells the website which registration an
  unmatched Zelle belongs to. It is marked PAID at once and the receipt goes out.
- **Zelle tab, Confirm**: applies a matched payment when auto-confirm is off.
- **Zelle tab, Accept the amount**: the member sent less; accept what arrived,
  mark PAID, send the receipt. **Note and chase** writes a note instead and
  leaves the registration unpaid until the rest arrives.
- **Record a Zelle by hand**: for a transaction the relay never saw.
- **Run expiry now**: does what the nightly job does, immediately.
- **Export CSV**: all registrations, same columns as the old spreadsheet.

## Nightly job

`vercel.json` schedules `/api/cron/expire-pending` at 09:00 UTC (about 3 AM in
Utah). It turns PENDING rows older than the expiry setting into EXPIRED and
writes an audit row for each. Check it exists under Vercel, Project Settings,
Cron Jobs. An EXPIRED row can still be confirmed if the money arrives late.

## Test checklist before the first real event

- [ ] Submit the form at /register: a code appears on screen, the row shows in
      Pending as "code email queued", the code email arrives within a couple of
      minutes and the row changes to "code emailed", the audit log has
      REGISTRATION_CREATED.
- [ ] Submit the same form again within a day: the same code comes back, no
      duplicate row.
- [ ] Real Zelle with the code in the memo: appears on the Zelle tab as
      matched within a few minutes; with auto-confirm on, the row is PAID and
      the receipt arrives (audit row AUTO_CONFIRMED).
- [ ] Lowercase memo with extra words: still matched.
- [ ] No memo: "no match", link it by hand, receipt arrives (LINK_PAYMENT).
- [ ] Short amount: "amount short", no receipt until you accept or the rest
      arrives.
- [ ] The relay runs again on the same emails: no second receipt, no
      duplicate rows.
- [ ] Mark paid (cash) on a walk-in: PAID, audit row MARK_PAID. A second Mark
      paid on the same code is refused.
- [ ] Void requires a reason and writes CANCELLED or REFUNDED.
- [ ] Export CSV: the paid total matches the number on the page.
- [ ] Sign out and open /admin/payments: you are asked to sign in.

## If something looks wrong

- "The payment tables could not be read": `supabase/payments.sql` has not been
  run, or the admin user is not signed in. The Zelle tab has its own notice
  when `payments_zelle.sql` is missing.
- "The payment system is not configured on the server": the service role key is
  missing on Vercel. Add it and redeploy.
- Header says "Last bank email: none yet" while payments are coming in: open
  the script project and run `listRecentBankEmails`. If it logs no bank
  emails, the alerts go to another mailbox and that mailbox must forward
  them to the BPAU Gmail. If it lists them as "not a Zelle alert", run
  `showNewestAlertText` and send the text to the developer so the parser can
  learn that wording. If it lists them as Zelle alerts and nothing arrives,
  check Triggers (the relay must be listed) and Executions for errors.
- Header says "Zelle relay secret missing": `ZELLE_INBOUND_SECRET` is not set
  on Vercel. The relay gets 401 until it is, and retries later.
- Email pill says "not configured": `EMAIL_PROVIDER` is empty, or it says
  `relay` but `ZELLE_INBOUND_SECRET` is missing, or it says `gmail` but
  `EMAIL_USER` or `EMAIL_APP_PASSWORD` is empty.
- "Emails waiting" keeps growing: the `sendQueuedEmails` trigger is not
  running, or the day's quota is used up. Open the script project, check
  Executions, run `testConnection` (it prints the quota left today), and run
  `installTriggers` again if the trigger is gone. Nothing is lost; the emails
  go out when the script runs.
- Rows say "code email failed" or "Emails failed" shows: the reason is in that
  row's History. With the relay, `payments_email.sql` may not have been run
  yet. With `gmail`, "Invalid login" or a 535 error means the App Password is
  wrong, 2-Step Verification is off, or Google has locked the account again.
  The system keeps working without email; fix the account or switch providers
  and use Resend receipt for anyone who missed one.
- Register buttons do not appear: registration is paused, the closing date has
  passed, or the page has not refreshed yet (up to one minute).

## What changed from the first version

- Google Sheet: replaced by Supabase tables (registrations, payments,
  raw_emails, payment_settings, audit_log).
- Apps Script web form and admin page: replaced by /register and
  /admin/payments on the website.
- MailApp: still sends the emails from the BPAU Gmail, but the website writes
  them first (the outbox) and the script sends what it finds there. Gmail SMTP
  with an App Password, or Resend with a domain, can replace it with one
  setting.
- Zelle email polling: still in Apps Script, but it only relays the emails.
  Parsing, matching, and confirming moved to the website.
- The old log_only switch is now "Auto-confirm Zelle payments" in Settings.
- The Pricing tab's pre-filled values (prices, dates, Zelle recipient, name,
  contact email) are pre-filled here too, in Settings and in the code, so a
  blank row never leaves members with nowhere to send money.
- Admin alerts for short amounts and overpayments go to the contact email in
  Settings.
