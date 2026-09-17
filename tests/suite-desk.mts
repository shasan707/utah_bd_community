// End-to-end exercise of the desk against the two existing TEST rows
// (both Qudrat's), then puts everything back and proves it was restored.
// Snapshots first, restores in a finally block even if something throws.
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
const ACTOR = "test-sweep@local";

let pass = 0, fail = 0;
const t = (name: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${name.padEnd(46)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};

const read = async (code: string) =>
  (await (await fetch(`${U}/registrations?code=eq.${code}&select=*`, { headers: hdr })).json())[0];

const FIELDS = ["checked_in_at", "checked_in_by", "coupons_collected_at", "coupons_collected_by", "name", "phone", "email", "amount_due", "status"];
const snap = (r: Record<string, unknown>) => Object.fromEntries(FIELDS.map((f) => [f, r[f]]));

const before: Record<string, Record<string, unknown>> = {};
for (const code of ["R-8E3U", "R-89YK"]) before[code] = snap(await read(code));
console.log("Snapshot taken of R-8E3U and R-89YK.\n");

try {
  console.log("== A PAID TICKET WITH COUPONS (R-8E3U: 1 adult, 1 coupon) ==");
  let r = await C.checkIn("R-8E3U", "", ACTOR);
  t("first scan admits", r.outcome, "checked_in");
  t("prompts for the coupon too", /hand over 1 coupon/i.test(r.message), true);
  r = await C.checkIn("R-8E3U", "", ACTOR);
  t("second scan refused", r.outcome, "already");

  r = await C.collectCoupons("R-8E3U", ACTOR);
  t("coupons handed over", r.outcome, "collected");
  t("says how many", /1 coupon/.test(r.message), true);
  r = await C.collectCoupons("R-8E3U", ACTOR);
  t("cannot collect twice", r.outcome, "already_collected");

  const mid = await read("R-8E3U");
  t("entry stamped", !!mid.checked_in_at, true);
  t("coupon stamp written", !!mid.coupons_collected_at, true);
  t("volunteer recorded", mid.coupons_collected_by, ACTOR);

  r = await C.undoCollectCoupons("R-8E3U", ACTOR);
  t("coupon handover undone", r.outcome, "undone");
  r = await C.undoCheckIn("R-8E3U", ACTOR);
  t("entry undone", r.outcome, "undone");

  console.log("\n== A PENDING ROW (R-89YK, underpaid, never confirmed) ==");
  r = await C.checkIn("R-89YK", "", ACTOR);
  t("unpaid refused at the door", r.outcome, "not_paid");
  r = await C.collectCoupons("R-89YK", ACTOR);
  t("unpaid refused coupons", r.outcome, "not_paid");

  console.log("\n== CODES THAT DO NOT EXIST OR ARE MALFORMED ==");
  t("unknown code", (await C.checkIn("R-ZZZZ", "", ACTOR)).outcome, "unknown");
  t("nonsense code", (await C.checkIn("hello", "", ACTOR)).outcome, "unknown");
  t("empty code", (await C.checkIn("", "", ACTOR)).outcome, "unknown");
  t("bad QR signature", (await C.checkIn("R-8E3U", "not-a-real-token", ACTOR)).outcome, "invalid");
  t("no coupons on a row", (await C.collectCoupons("R-89YK", ACTOR)).outcome, "not_paid");

  console.log("\n== A COUPON-ONLY CODE MUST NOT ADMIT ANYONE ==");
  // Built here, exercised, and deleted in the finally block below.
  const made = await fetch(`${U}/registrations`, {
    method: "POST", headers: hdr,
    body: JSON.stringify({ code: "C-TEST", name: "Sweep Coupon Buyer", phone: "5550000000", email: "", adults: 0, youth: 0, children: 0, coupons_qty: 10, donation: 0, amount_due: 15, amount_received: 15, status: "PAID", payment_method: "cash", created_by: "test-sweep" }),
  });
  if (!made.ok) throw new Error(`could not create the probe row: ${await made.text()}`);
  r = await C.checkIn("C-TEST", "", ACTOR);
  t("coupon code is NOT admitted", r.outcome, "coupons_only");
  t("says no wristband", /no wristband/i.test(r.message), true);
  t("no entry stamp written", !!(await read("C-TEST")).checked_in_at, false);
  r = await C.collectCoupons("C-TEST", ACTOR);
  t("but coupons can be collected", r.outcome, "collected");
  t("all ten", /10 coupons/.test(r.message), true);

  console.log("\n== A DONATION-ONLY CODE ==");
  const made2 = await fetch(`${U}/registrations`, {
    method: "POST", headers: hdr,
    body: JSON.stringify({ code: "D-TEST", name: "Sweep Donor", phone: "5550000001", email: "", adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 50, amount_due: 50, amount_received: 50, status: "PAID", payment_method: "cash", created_by: "test-sweep" }),
  });
  if (!made2.ok) throw new Error(`could not create the probe row: ${await made2.text()}`);
  r = await C.checkIn("D-TEST", "", ACTOR);
  t("donation code is NOT admitted", r.outcome, "nothing_to_admit");
  r = await C.collectCoupons("D-TEST", ACTOR);
  t("nothing to collect", r.outcome, "no_coupons");
} finally {
  console.log("\n== CLEAN UP ==");
  for (const code of ["C-TEST", "D-TEST"]) {
    await fetch(`${U}/registrations?code=eq.${code}`, { method: "DELETE", headers: hdr });
  }
  await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}`, { method: "DELETE", headers: hdr });
  for (const code of ["R-8E3U", "R-89YK"]) {
    await fetch(`${U}/registrations?code=eq.${code}`, { method: "PATCH", headers: hdr, body: JSON.stringify(before[code]) });
    const now = snap(await read(code));
    t(`${code} restored exactly`, now, before[code]);
  }
  const left = await (await fetch(`${U}/registrations?or=(code.eq.C-TEST,code.eq.D-TEST)&select=code`, { headers: hdr })).json();
  t("probe rows removed", left.length, 0);
  const auditLeft = await (await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}&select=id`, { headers: hdr })).json();
  t("test audit rows removed", auditLeft.length, 0);
  const total = await fetch(`${U}/registrations?select=code`, { headers: { ...hdr, Prefer: "count=exact", Range: "0-0" } });
  console.log(`  .. registrations now: ${total.headers.get("content-range")}`);
  console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
