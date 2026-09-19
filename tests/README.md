# Tests

Run them from the project root:

```
npm test                     the suites that only read
ALLOW_DB_TESTS=1 npm test    every suite, including the ones that write
npm test -- owing            one suite, by any part of its name
```

They need `.env.local`, the same file the site uses.

## Why two kinds

Four suites exercise the money code the only way that proves anything:
against a real database. They create rows with throwaway codes, put them
through the desk and the payment matcher, then delete them and check the
deletion. Every one restores what it touched.

They are held behind `ALLOW_DB_TESTS=1` because `.env.local` points at the
live project. Running them by accident would write and remove real-looking
registrations in front of whoever is watching the admin.

The read-only suites are safe at any time. `suite-db` only sends inserts it
expects to be rejected, and `suite-live` fetches the deployed site.

## What each one covers

| Suite | Writes | Covers |
|---|---|---|
| `suite-logic` | no | pricing across the three age bands, coupon bundles, the donation minimum, Zelle memo matching, bank email parsing, Utah times, venue addresses |
| `suite-msg` | no | every email and text, for attendees, coupon buyers, donors and top-ups, plus what each text costs in segments |
| `suite-venmo` | no | the Venmo notification parser, the pay and profile links, and what members are told with Venmo off and on |
| `suite-live` | no | the deployed pages, the pricing API, and that the two venue records agree |
| `suite-db` | no | the database refusing out-of-range counts, invented statuses and duplicate codes on its own |
| `suite-desk` | yes | entry and coupon handover, each stamped once, and a coupon-only code never admitting anyone |
| `suite-firstpay` | yes | the first payment against a code, by hand and automatically, in full and short |
| `suite-topup` | yes | adding to a code that is already paid: balances, partial payments, double credits, overpayment |
| `suite-reverse` | yes | coupons or a donation first and seats afterwards |
| `suite-owing` | yes | a balance owing holding back wristbands as well as coupons |

## Adding to them

The suites are plain scripts: no framework, no config. `t(name, got, want)`
compares with `JSON.stringify` and counts. A suite prints
`N passed, M failed` at the end, which is all the runner reads.

Anything that writes belongs in the `writes: true` list in `run.mjs`, must
use codes from the real alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, so no
`I L O 0 1`), and must clean up in a `finally` block and assert that it did.
