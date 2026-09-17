// End-to-end exercise of the desk: entry, coupon handover, the undo of each,
// and the codes that must be turned away.
//
// Every row here is built by this file and deleted again. An earlier version
// borrowed two real registrations, checked them in, and put them back from a
// snapshot. That was wrong twice over: a crash between the check-in and the
// restore would have left a real guest marked as arrived, and the day those
// two registrations were cleared the suite could not run at all.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const B = "@";
const C = await import(`${B}/lib/payments/checkin.ts`);

const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const hdr = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const ACTOR = "desk-sweep@local";
const TICKET = "R-DSKA";   // paid, 1 adult, 1 coupon
const UNPAID = "R-DSKB";   // pending, nothing received
const COUPON = "C-DSKC";   // coupons only, paid
const DONOR = "D-DSKD";    // donation only, paid
const CODES = [TICKET, UNPAID, COUPON, DONOR];
const PHONE = "5559993333";   // distinct from the other suites: cleanup deletes by phone

let pass = 0, fail = 0;
const t = (name: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${name.padEnd(46)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};

const read = async (code: string) =>
  (await (await fetch(`${U}/registrations?code=eq.${code}&select=*`, { headers: hdr })).json())[0];

const make = async (code: string, o: Record<string, unknown>) => {
  const res = await fetch(`${U}/registrations`, {
    method: "POST", headers: hdr,
    body: JSON.stringify({
      code, name: "Desk Tester", phone: PHONE, email: "",
      adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0,
      amount_due: 0, status: "PENDING", created_by: "desk-sweep", ...o,
    }),
  });
  if (!res.ok) throw new Error(`could not create ${code}: ${await res.text()}`);
};

try {
  await make(TICKET, { adults: 1, coupons_qty: 1, amount_due: 22, amount_received: 22, status: "PAID", payment_method: "cash", paid_at: new Date().toISOString() });
  await make(UNPAID, { adults: 1, amount_due: 20, amount_received: 0, status: "PENDING" });

  console.log("== A PAID TICKET WITH COUPONS (1 adult, 1 coupon) ==");
  let r = await C.checkIn(TICKET, "", ACTOR);
  t("first scan admits", r.outcome, "checked_in");
  t("prompts for the coupon too", /hand over 1 coupon/i.test(r.message), true);
  r = await C.checkIn(TICKET, "", ACTOR);
  t("second scan refused", r.outcome, "already");

  r = await C.collectCoupons(TICKET, ACTOR);
  t("coupons handed over", r.outcome, "collected");
  t("says how many", /1 coupon/.test(r.message), true);
  r = await C.collectCoupons(TICKET, ACTOR);
  t("cannot collect twice", r.outcome, "already_collected");

  const mid = await read(TICKET);
  t("entry stamped", !!mid.checked_in_at, true);
  t("coupon stamp written", !!mid.coupons_collected_at, true);
  t("volunteer recorded", mid.coupons_collected_by, ACTOR);

  r = await C.undoCollectCoupons(TICKET, ACTOR);
  t("coupon handover undone", r.outcome, "undone");
  r = await C.undoCheckIn(TICKET, ACTOR);
  t("entry undone", r.outcome, "undone");
  const after = await read(TICKET);
  t("both stamps cleared", [!!after.checked_in_at, !!after.coupons_collected_at], [false, false]);

  console.log("\n== A PENDING ROW (never paid) ==");
  r = await C.checkIn(UNPAID, "", ACTOR);
  t("unpaid refused at the door", r.outcome, "not_paid");
  t("the desk is told the amount", /\$20\.00/.test(r.message), true);
  r = await C.collectCoupons(UNPAID, ACTOR);
  t("unpaid refused coupons", r.outcome, "not_paid");

  console.log("\n== CODES THAT DO NOT EXIST OR ARE MALFORMED ==");
  t("unknown code", (await C.checkIn("R-ZZZZ", "", ACTOR)).outcome, "unknown");
  t("nonsense code", (await C.checkIn("hello", "", ACTOR)).outcome, "unknown");
  t("empty code", (await C.checkIn("", "", ACTOR)).outcome, "unknown");
  t("bad QR signature", (await C.checkIn(TICKET, "not-a-real-token", ACTOR)).outcome, "invalid");

  console.log("\n== A COUPON-ONLY CODE MUST NOT ADMIT ANYONE ==");
  await make(COUPON, { coupons_qty: 10, amount_due: 15, amount_received: 15, status: "PAID", payment_method: "cash", paid_at: new Date().toISOString() });
  r = await C.checkIn(COUPON, "", ACTOR);
  t("coupon code is NOT admitted", r.outcome, "coupons_only");
  t("says no wristband", /no wristband/i.test(r.message), true);
  t("no entry stamp written", !!(await read(COUPON)).checked_in_at, false);
  r = await C.collectCoupons(COUPON, ACTOR);
  t("but coupons can be collected", r.outcome, "collected");
  t("all ten", /10 coupons/.test(r.message), true);

  console.log("\n== A DONATION-ONLY CODE ==");
  await make(DONOR, { donation: 50, amount_due: 50, amount_received: 50, status: "PAID", payment_method: "cash", paid_at: new Date().toISOString() });
  r = await C.checkIn(DONOR, "", ACTOR);
  t("donation code is NOT admitted", r.outcome, "nothing_to_admit");
  r = await C.collectCoupons(DONOR, ACTOR);
  t("nothing to collect", r.outcome, "no_coupons");
} catch (err) {
  fail++;
  console.log(`\n  !! THREW: ${err instanceof Error ? err.stack : String(err)}`);
} finally {
  console.log("\n== CLEAN UP ==");
  for (const code of CODES) {
    await fetch(`${U}/registrations?code=eq.${code}`, { method: "DELETE", headers: hdr });
    await fetch(`${U}/audit_log?entity_code=eq.${code}`, { method: "DELETE", headers: hdr });
  }
  await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}`, { method: "DELETE", headers: hdr });
  const left = await (await fetch(`${U}/registrations?phone=eq.${PHONE}&select=code`, { headers: hdr })).json();
  t("probe rows removed", left.length, 0);
  const auditLeft = await (await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}&select=id`, { headers: hdr })).json();
  t("test audit rows removed", auditLeft.length, 0);
  const total = await fetch(`${U}/registrations?select=code`, { headers: { ...hdr, Prefer: "count=exact", Range: "0-0" } });
  console.log(`  .. registrations now: ${total.headers.get("content-range")}`);
  console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
