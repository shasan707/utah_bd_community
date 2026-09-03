# BPAU Zelle Payment System, Setup Runbook

**Retired (September 2026).** This Google Apps Script version depended on a
Gmail account that got locked. The payment system now runs inside the website
on Supabase and Next.js. See `docs/payments-runbook.md`. This folder stays only
until the new system has been verified on the live site, then it is deleted.

Everything below is done by you, logged into the bpau Gmail account in your browser.
No password ever needs to be shared with anyone.

**First, two security tasks (do these today):**
1. Change the bpau Gmail password (it was shared in a chat).
2. Turn on 2-Step Verification for the account.

---

## Step 1. Install clasp and log in (one time)

Open a terminal in this folder (`apps-script/`) and run:

```
npm install -g @google/clasp
clasp login
```

A browser opens. Log in as the bpau Gmail account and click Allow.
This authorizes code pushing only; the assistant never sees the password.

Then enable the Apps Script API for the account (one click):
open https://script.google.com/home/usersettings and turn ON "Google Apps Script API".

## Step 2. Create the project and push the code

```
clasp create --type standalone --title "BPAU Payments"
clasp push
```

If `clasp create` complains about existing files, run `clasp create` first in an
empty folder, copy the generated `.clasp.json` here, then `clasp push`.

## Step 3. Initialize the Sheet

1. Run `clasp open` (opens the project at script.google.com).
2. In the editor, select the function `initSheet` and click Run.
3. Approve the permission screen (it will warn because the app is unverified;
   click Advanced, then "Go to BPAU Payments"). This is your own script.
4. Open View > Logs. Copy the Sheet URL and bookmark it.
5. Open the Sheet, go to the Pricing tab, and fix the values:
   real prices, event dates, the Zelle recipient address people pay to,
   `admin_emails` (comma-separated Google accounts of at least TWO committee members),
   and leave `log_only` = TRUE for now.

## Step 4. Deploy the two web pages

In the Apps Script editor, click Deploy > New deployment > Web app.

Deployment 1, the public form:
- Description: form
- Execute as: Me
- Who has access: Anyone
- Copy the URL. This is the registration form link for the website.

Deployment 2, the admin panel:
- Deploy > New deployment > Web app again
- Description: admin
- Execute as: Me
- Who has access: Anyone with a Google account
- The admin URL is that link plus `?page=admin`
- Only accounts listed in `admin_emails` get in; everyone else sees "Not authorized".

## Step 5. Test the manual system (it is already usable)

- Open the form URL, submit a test registration.
- Check: a PENDING row appears in Registrations, and the pending email arrives
  with the code and amount.
- Open the admin URL, find the row under Pending, click Mark Paid (method: cash).
- Check: receipt email arrives, AuditLog has rows.

At this point the system works with zero automation. You can run a real event
like this if needed.

## Step 6. Gmail forwarding (the automation feed)

On the personal Gmail that receives Wells Fargo alerts:
1. Settings > Forwarding and POP/IMAP > Add a forwarding address: the bpau Gmail.
2. Google sends a confirmation code to the bpau inbox; verify it.
3. Settings > Filters > Create filter:
   - From: the Wells Fargo alerts sender address
   - Subject contains: `sent you`
   - Action: Forward to the bpau Gmail. Do NOT choose "delete it".

On the bpau Gmail:
1. Settings > Filters > Create filter:
   - From: the Wells Fargo alerts sender (it survives forwarding)
   - Subject contains: `sent you`
   - Action: Apply label `BPAU-Zelle` (create the label in the filter dialog).

Note: the email address enrolled with Zelle (where people send money) is a
separate setting from where Wells Fargo sends alert emails. Changing one does
not change the other.

## Step 7. Install the triggers

In the Apps Script editor, run the function `installTriggers` once.
This creates the 5-minute email poll and the daily 3 AM maintenance job.
During the final week before an event you may change `poll_interval_minutes`
to 1 in the Pricing tab and run `installTriggers` again.

## Step 8. Watch log-only mode for a week

With `log_only` = TRUE the parser records every Zelle email in the Payments tab
but never marks anyone paid and never sends receipts. Watch it for about a week:

- Send yourself a real Zelle with a correct code in the memo.
- Check the Payments tab shows MATCHED with the right code.
- Try a lowercase memo with filler words. Still MATCHED.
- Try no memo. It should land as UNMATCHED without crashing.

When a week has been clean, open the admin panel and click
"Turn auto-confirm ON" (or set `log_only` to FALSE in the Pricing tab).

## Test checklist before the first real event

- [ ] Submit form: PENDING row plus pending email
- [ ] Real Zelle with correct code: auto-confirms, receipt arrives
- [ ] Lowercase code with filler words (`for r7x3m please`): still matches
- [ ] No memo: lands in UNMATCHED, no crash
- [ ] Wrong amount: AMOUNT_MISMATCH, no receipt
- [ ] Re-run the poll on processed emails: zero duplicate receipts
- [ ] Delete a trigger, wait 25h: heartbeat alert arrives
- [ ] Record a cash payment in admin: AuditLog row appears
- [ ] Export CSV: totals match the sheet

## Updating the code later

Any fix is: edit files in this folder, then `clasp push`. Deployments that run
"Execute as: Me" with "New deployment" pinned need Deploy > Manage deployments >
Edit > Version: New version to pick up pushed changes.
