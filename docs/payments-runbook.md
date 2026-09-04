# BPAU Registration and Zelle Payments, Runbook

This replaces the old Google Apps Script system (apps-script/SETUP.md). The
website and its database (Supabase) do all the work. The only Google piece left
is the Gmail account that sends the code and receipt emails. If Google ever
locks that account again, only the emails stop; registrations, codes, and the
admin keep working.

## How it works, in one paragraph

A member fills the form at /register. The server saves a PENDING row, gives
them a short code such as R-7X3M, and emails the code with Zelle instructions.
The member sends the Zelle with the code in the memo. The treasurer sees the
payment in the bank app, opens /admin/payments, finds the code, and clicks Mark
paid. The member gets a receipt email. Every action is written to an audit log.
Codes that stay unpaid for 72 hours expire on their own every night.

## One-time setup

### 1. Database

In the Supabase dashboard open SQL Editor, paste the contents of
`supabase/payments.sql`, and run it. This creates four tables:
`payment_settings`, `registrations`, `payments`, and `audit_log`, with row level
security. Run it once only.

Also check Authentication, Providers, Email: turn off "Allow new users to sign
up". Anyone who can sign in to /admin can see every registration, so accounts
must be created by hand (Authentication, Users, Add user).

### 2. Server secrets

The site needs these environment variables. Locally they go in `.env.local`.
On Vercel they go in Project Settings, Environment Variables, for Production.

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, Project Settings, API, service_role key. Never put this in a NEXT_PUBLIC variable. |
| `CRON_SECRET` | Any long random string. Vercel sends it when it runs the nightly expiry job. |
| `EMAIL_PROVIDER` | `gmail`. Leave empty to send no email. (`resend` or `brevo` also work, with a verified domain.) |
| `EMAIL_USER` | The Gmail address that sends, for example `bpau.pay@gmail.com`. |
| `EMAIL_APP_PASSWORD` | A 16 character App Password from that Gmail account (see step 3). |
| `EMAIL_FROM` | `BPAU <bpau.pay@gmail.com>`. Gmail always uses the account address; this only sets the display name. |

After adding or changing variables, redeploy.

### 3. Email (Gmail)

The emails are sent through the BPAU Gmail account, the same address members
saw before. Nothing else from the old system is used: no Apps Script, no
Sheet, no forwarding rules. Keep that account quiet and it should stay healthy.

1. Sign in to the Gmail account. Google Account, Security: turn on 2-Step
   Verification if it is not on already.
2. On the same Security page open "App passwords" (search for it if hidden).
   Create one named "Utha USA website". Google shows a 16 character password
   once. Copy it.
3. In Vercel set `EMAIL_PROVIDER=gmail`, `EMAIL_USER` to the Gmail address,
   `EMAIL_APP_PASSWORD` to that password, and `EMAIL_FROM=BPAU <the address>`.
   Redeploy.
4. Register once on /register with your own email and check the code email
   arrives. Mark it paid in the admin and check the receipt arrives.

Gmail allows about 500 emails a day from a normal account, far more than an
event needs. Do not add this account to Apps Script, forwarding rules, or any
other automation; sending mail with an App Password is a normal, supported use.

If you later own a domain, Resend is the cleaner option: verify the domain
there, then set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, and `EMAIL_FROM` on
that domain. No code change.

Until email is set up, the system still works: members see their code and the
Zelle instructions on screen and can email the instructions to themselves.
The admin shows "code not emailed (email off)" on those rows.

### 4. Zelle recipient

Decide which Zelle alias people send money to. It must be an email or phone
number enrolled in Zelle at the bank that holds BPAU's money. The
bpau.pay@gmail.com alias still works at the bank, but a phone number, or an
address Google cannot lock, is the safer choice. Enter it in Settings on
/admin/payments together with the name Zelle shows for it.

### 5. Turn it on

On /admin/payments, Settings tab: check the event name, dates, prices, Zelle
recipient, and contact email. Tick "Registration is open" and save. Within a
minute the Register buttons appear on the site.

Registration closes by itself at the end of the "Registration closes" date
(Utah time). Untick "Registration is open" to pause it at any time.

## Treasurer's daily flow

1. Open the bank app and look at incoming Zelle payments. Each memo should
   carry a code.
2. Open /admin/payments. The Pending tab lists everyone waiting, newest first.
   Rows older than 48 hours are outlined in amber.
3. Find the code, click Mark paid, pick the method (zelle by default), confirm
   the amount, and paste the Zelle confirmation number into the note.
4. The member gets a receipt by email. If the receipt could not be sent, the row
   says so and you can use Resend receipt later.
5. At the door, use the All registrations tab (search by name or code) or the
   CSV export.

Zelle with no code in the memo: search the All tab by the sender's name or the
amount, then Mark paid on the matching row and note the confirmation number.

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
- **Run expiry now**: does what the nightly job does, immediately.
- **Export CSV**: all registrations, same columns as the old spreadsheet.

## Nightly job

`vercel.json` schedules `/api/cron/expire-pending` at 09:00 UTC (about 3 AM in
Utah). It turns PENDING rows older than the expiry setting into EXPIRED and
writes an audit row for each. Check it exists under Vercel, Project Settings,
Cron Jobs. An EXPIRED row can still be marked paid if the money arrives late.

## Test checklist before the first real event

- [ ] Submit the form at /register: a code appears on screen, the row shows in
      Pending, the audit log has REGISTRATION_CREATED.
- [ ] With email set up: the code email arrives with the right amount and Zelle
      recipient.
- [ ] Submit the same form again within a day: the same code comes back, no
      duplicate row.
- [ ] Mark paid (zelle): status PAID, receipt arrives, audit row MARK_PAID.
- [ ] Mark paid again on the same code: refused with "already PAID".
- [ ] Void requires a reason and writes CANCELLED or REFUNDED.
- [ ] New entry with "Mark as paid now": PAID row plus two audit rows.
- [ ] Export CSV: the paid total matches the number on the page.
- [ ] Run expiry now: nothing unexpected expires.
- [ ] Sign out and open /admin/payments: you are asked to sign in.

## If something looks wrong

- "The payment tables could not be read": `supabase/payments.sql` has not been
  run, or the admin user is not signed in.
- "The payment system is not configured on the server": the service role key is
  missing on Vercel. Add it and redeploy.
- Email pill says "not configured": `EMAIL_PROVIDER`, `EMAIL_USER`, or
  `EMAIL_APP_PASSWORD` is empty.
- Emails fail with "Invalid login" or a 535 error: the App Password is wrong,
  2-Step Verification is off, or Google has locked the account again. The
  system keeps working without email; fix the account or switch providers and
  use Resend receipt for anyone who missed one. The exact error is stored on
  the row and shown in History.
- With Resend: the domain is not verified or the API key is wrong.
- Register buttons do not appear: registration is paused, the closing date has
  passed, or the page has not refreshed yet (up to one minute).

## What is deliberately not automated yet

The old system read forwarded Wells Fargo alert emails and confirmed payments by
itself. That needed a Gmail account and is not part of this version. The
`payments` table and the matching rules are kept so an inbound-email webhook can
be added later without changing the database. Until then the treasurer confirms
each payment with one click.
