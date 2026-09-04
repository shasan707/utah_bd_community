# BPAU Registration and Zelle Payments, Runbook

This is the same process as the first version: members register, get a code,
send a Zelle with the code in the memo, and the bank's alert email confirms
the payment automatically. What changed is where it runs. The website and its
database (Supabase) hold the form, the codes, the matching, the receipts, the
admin, and the audit log. The BPAU Gmail account keeps two quiet jobs only:
sending the emails and relaying the bank's Zelle alerts to the website.

If Google ever locks that account again, emails and automatic confirmation
stop, but registrations, codes, and the admin keep working, and you can
confirm payments by hand until it is back.

## How it works

1. A member fills the form at /register. The server saves a PENDING row, gives
   them a short code such as R-7X3M, and emails the code with the Zelle
   instructions.
2. The member sends the Zelle with the code in the memo.
3. Wells Fargo emails a "sent you $25.00" alert. A Gmail filter labels it
   BPAU-Zelle. Every 5 minutes the relay script hands new labeled emails to
   the website.
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
`supabase/payments.sql`, then `supabase/payments_zelle.sql`.

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
| `EMAIL_PROVIDER` | `gmail`. Leave empty to send no email. (`resend` or `brevo` also work, with a verified domain.) |
| `EMAIL_USER` | The Gmail address that sends, for example `bpau.pay@gmail.com`. |
| `EMAIL_APP_PASSWORD` | A 16 character App Password from that Gmail account (see step 3). |
| `EMAIL_FROM` | `BPAU <bpau.pay@gmail.com>`. Gmail always uses the account address; this only sets the display name. |

### 3. Email (Gmail)

1. Sign in to the BPAU Gmail. Google Account, Security: turn on 2-Step
   Verification if it is not on already.
2. On the same Security page open "App passwords" (search for it if hidden).
   Create one named "Utha USA website". Google shows a 16 character password
   once. Copy it into `EMAIL_APP_PASSWORD`.
3. Register once on /register with your own email and check the code email
   arrives. Mark it paid in the admin and check the receipt arrives.

Gmail allows about 500 emails a day from a normal account, far more than an
event needs. Sending mail with an App Password and reading mail with a
time-based script are both ordinary uses. Do not deploy a web app in that
account again.

If you later own a domain, Resend is the cleaner option: verify the domain
there, then set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, and `EMAIL_FROM` on
that domain. No code change.

### 4. The Zelle relay (Gmail)

Follow `apps-script/SETUP.md`: push `Zelle.gs` to the existing script project,
archive the two old web app deployments, set the two Script Properties
(`WEBSITE_URL`, `INBOUND_SECRET`), set up the Gmail forwarding and the
BPAU-Zelle label filter, run `testConnection`, then run `installTriggers`.

### 5. Zelle recipient

Decide which Zelle alias people send money to. It must be an email or phone
number enrolled in Zelle at the bank that holds BPAU's money. The
bpau.pay@gmail.com alias still works at the bank, but a phone number, or an
address Google cannot lock, is the safer choice. Enter it in Settings on
/admin/payments together with the name Zelle shows for it.

### 6. Turn it on

On /admin/payments, Settings tab: check the event name, dates, prices, Zelle
recipient, and contact email. Leave "Auto-confirm Zelle payments" off for the
first week. Tick "Registration is open" and save. Within a minute the Register
buttons appear on the site.

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

1. Open /admin/payments. The header shows when the last bank email arrived.
   If it says "none yet" during an open registration window, check the Gmail
   filter and the trigger (see below).
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

- [ ] Submit the form at /register: a code appears on screen, the code email
      arrives, the row shows in Pending, the audit log has REGISTRATION_CREATED.
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
- Header says "Last bank email: none yet" while payments are coming in: the
  Gmail filter is not labeling the alerts, the forwarding rule is off, or the
  trigger is gone. Open the script project, check Executions, and run
  `testConnection`.
- Header says "Zelle relay secret missing": `ZELLE_INBOUND_SECRET` is not set
  on Vercel. The relay gets 401 until it is, and retries later.
- Email pill says "not configured": `EMAIL_PROVIDER`, `EMAIL_USER`, or
  `EMAIL_APP_PASSWORD` is empty.
- Emails fail with "Invalid login" or a 535 error: the App Password is wrong,
  2-Step Verification is off, or Google has locked the account again. The
  system keeps working without email; fix the account or switch providers and
  use Resend receipt for anyone who missed one. The exact error is stored on
  the row and shown in History.
- Register buttons do not appear: registration is paused, the closing date has
  passed, or the page has not refreshed yet (up to one minute).

## What changed from the first version

- Google Sheet: replaced by Supabase tables (registrations, payments,
  raw_emails, payment_settings, audit_log).
- Apps Script web form and admin page: replaced by /register and
  /admin/payments on the website.
- MailApp: replaced by Gmail SMTP with an App Password (or Resend later).
- Zelle email polling: still in Apps Script, but it only relays the emails.
  Parsing, matching, and confirming moved to the website.
- The old log_only switch is now "Auto-confirm Zelle payments" in Settings.
- Admin alerts for short amounts and overpayments go to the contact email in
  Settings.
