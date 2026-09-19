# Venmo as a second payment method, and test rows that stay out of the real data

Approved 19 September 2026, with live registrations in the system and members paying. Every step here is additive and separately reversible; nothing changes what a member sees until the final switch is flipped.

## Requirement

Venmo must behave exactly as Zelle does today: a member gets a code, pays with the code in the note, the relay reads the notification email, the registration is confirmed and the ticket goes out with no click. Members see Zelle first and Venmo as the alternative.

Admins must be able to rehearse the whole flow on the live site without a rehearsal row ever being counted, listed or handed a wristband as if it were real.

## Order

Test separation is built first. It is what makes rehearsing Venmo on the live site safe.

## Part 1: test rows

### Data

One column on `registrations` and one on `payments`: `is_test boolean not null default false`. Every existing row is real by default and is never touched. No new code prefix: a `T-` code would ripple through the parser, the QR signing, the tracker and the desk for no gain. The QR of a test row scans exactly as a real one.

### How a test row is born

The public `/register` form shows a "This is a test" switch only when a signed-in admin's Supabase session exists in that browser. On submit the form sends the admin's access token, and the server accepts `test: true` only after `requireAdmin` verifies it. Anyone without a valid admin token who sends `test: true` gets 403. The admin's own create form has the same switch.

### What "not mixing" means

| Where | Test rows are |
|---|---|
| Admin dashboard, registrations, payments | hidden by default; a "Show test (n)" toggle reveals them |
| Money and headcount totals, CSV export | never included, whatever the toggle says |
| Check-in desk | shown with a TEST badge so scanning can be rehearsed; excluded from every count |
| Ticket page | a TEST ribbon so it can never pass for a real ticket |
| Email and SMS | sent exactly as real, subject prefixed `[TEST]`, text prefixed `TEST:` |
| Top-ups | a test row joins only another test row; a real row only a real row. Without this a tester using their own phone would be merged into their own real registration |
| Payment matching | a memo naming a test code matches it. The fallback that matches by amount and sender name ignores test rows, so a member with no memo cannot land on one. A payment linked to a test code is flagged test itself |
| Expiry sweep | applies equally |

### Cleanup

One admin action, "Delete all test data". It counts first, deletes payments, audit rows and registrations `where is_test = true`, and refuses outright if any query it is about to run would touch a row that is not flagged test.

### Automated tests

The database-writing suites create their throwaway rows with `is_test = true`, so they are invisible to the admin while they exist. The `ALLOW_DB_TESTS` guard stays.

## Part 2: Venmo

### Switch

Two settings, `venmo_handle` and `venmo_name`, blank by default. Blank means Venmo is offered nowhere. The code ships with Venmo off; the admin turns it on from Settings once the rehearsal passes. Blanking the handle turns it off again in seconds.

### What members see once on

Zelle stays first everywhere. The register confirmation, the pending email (text and HTML), the pending SMS and the tracker each gain one Venmo line: handle, name, and the code to put in the note. The email has an "Open Venmo" button using `https://account.venmo.com/pay?txn=pay&recipients=<handle>&amount=<owed>&note=<code>`; if a real phone does not honour the prefill, the link falls back to `https://venmo.com/u/<handle>` and the member types the amount and note. The pending SMS is already two segments; the Venmo line keeps it at two.

### Auto-confirm

A separate pure parser, `lib/payments/venmo-parse.ts`, tried after the Zelle parser. The Zelle parser is not edited: every live confirmation so far went through it. The Venmo parser is written against a real Venmo notification captured during the rehearsal, which becomes its unit-test fixture. Until then it is written to Venmo's known shape (from venmo.com, subject "<name> paid you $<amount>", the note in the body) and marked as awaiting the fixture.

`payments` gains `provider text not null default 'zelle'` (`zelle` | `venmo`). `applyPayment` records the real method on the registration instead of the hard-coded `zelle`. The admin payments tab shows the provider; the "confirmed automatically" count covers both.

The relay script (`apps-script/Zelle.gs`) gains `from:venmo.com` in its queries and "paid you" in its pre-filter. It is pushed with `clasp` only after the site with the parser is deployed, because an email the site cannot parse is stored once and never looked at again.

### Assumption

`@evue007` is a personal profile. Personal-to-personal payments are free to both sides. A business profile charges the receiver on every payment.

## Rollout

1. SQL, additive only: `is_test` on both tables, `provider` on payments, the two Venmo settings rows blank. Run before any code deploys; the current code does not read these columns and is unaffected.
2. Deploy test separation. Verify with one test registration through the public form: hidden by default, badged at the desk, ribboned on the ticket, deletable.
3. Deploy the Venmo code with the handle blank. Members see nothing new.
4. Push the relay filters with `clasp`.
5. Rehearsal: a test registration, then $0.01 to `@evue007` with the test code in the note. Proves the notification reaches the relay's inbox, the parser reads it, the ticket arrives. The captured email becomes the parser fixture.
6. Set `venmo_handle` and `venmo_name` in Settings. Venmo is live.

## Not doing

No "choose Zelle or Venmo" selector on the form. No separate staging database. No `T-` codes. No Venmo API; there is none for receiving payments like this.
