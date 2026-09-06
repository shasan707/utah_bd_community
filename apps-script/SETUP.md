# BPAU Gmail Script, Setup

This folder holds the one small script that still runs in the BPAU Gmail
account. It does two things on timers: it sends the emails the website queues
(the code email after the form, the receipt after confirmation) from this
account, and it reads the bank's Zelle alert emails and hands them to the
website. Everything else (form, codes, matching, receipts, admin, audit log)
lives in the website. See `docs/payments-runbook.md` for the whole system.

The old Apps Script system (web form, Google Sheet, admin page) is gone. Do
not deploy this project as a web app.

## 1. Push the code

In this folder:

```
npm install -g @google/clasp
clasp login          (as the BPAU Gmail)
clasp push
```

`clasp push` replaces the old files in the existing script project with
`Zelle.gs` and `appsscript.json`. Or skip clasp: open script.google.com, open
the "BPAU Payments" project, delete the old files, paste `Zelle.gs` in, and
also replace the manifest: Project Settings, tick "Show appsscript.json
manifest file in editor", then paste this folder's `appsscript.json` over it
(it lists the send-mail permission the script needs).

## 2. Clean up the old deployments

In the Apps Script editor: Deploy > Manage deployments. Archive both old web
app deployments (form and admin). They are not used any more and a public web
app is the kind of thing that gets an account flagged.

## 3. Script Properties

Project Settings (gear icon) > Script Properties > Add:

- `WEBSITE_URL` = `https://uthahbdcommunity.vercel.app`
- `INBOUND_SECRET` = the same long random string you put in Vercel as
  `ZELLE_INBOUND_SECRET`

## 4. Gmail labels and forwarding

Same as before. The bank sends Zelle alerts to the email registered with Wells
Fargo. If that is not the BPAU Gmail:

On the personal Gmail that receives the Wells Fargo alerts:
1. Settings > Forwarding and POP/IMAP > Add a forwarding address: the BPAU Gmail.
2. Confirm the code Google sends to the BPAU inbox.
3. Settings > Filters > Create filter: From the Wells Fargo alerts sender,
   Subject contains `sent you`, action Forward to the BPAU Gmail. Do not delete.

On the BPAU Gmail, a filter is optional. The relay looks at every email from
wellsfargo.com, zellepay.com, or zelle.com on its own, plus anything carrying
the label `BPAU-Zelle`, and only passes on the ones that read like a Zelle
alert. The label is still useful if the bank ever writes from another
address: Settings > Filters > Create filter, action Apply label `BPAU-Zelle`.

Two diagnostics you can run from the editor at any time:
- `listRecentBankEmails`: every bank or Zelle email of the last 30 days, with
  its sender, subject, labels, and whether the relay would pick it up. If it
  logs "No email from Wells Fargo or Zelle", the alerts are going to another
  mailbox and that mailbox needs to forward them here.
- `showNewestAlertText`: the text of the newest alert, to compare with what
  the website expects.

## 5. Test and start

In the editor, select `testConnection` and Run. Approve the permission screen
(Gmail, "Send email as you", and external requests; it is your own script).
The log should show `Website: HTTP 200`, `Secret check: HTTP 400 ... No
messages.`, and how many emails the account can still send today. A 401 on
the second line means the secret does not match Vercel.

Then select `installTriggers` and Run once. From now on `sendQueuedEmails`
runs every minute and sends whatever the website has queued, and
`relayZelleEmails` runs every 5 minutes and labels each handled thread
`BPAU-Zelle-Processed`.

On Vercel, `EMAIL_PROVIDER` must be `relay` and `supabase/payments_email.sql`
must have been run once, or there is nothing for the script to send.

## 6. Watch it for a week

On the website, /admin/payments, Settings: leave "Auto-confirm Zelle payments"
off. Send yourself a real Zelle with a code in the memo and check the Zelle
tab shows it as matched within a few minutes. Try a lowercase memo with extra
words, a memo with no code, and a short amount. When a week looks right, turn
auto-confirm on.
