// The money core under top-ups: balances, partial payments, double credits,
// overpayment, and the coupon hold. Uses throwaway rows it creates and
// deletes; touches no existing registration.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const B = "@/lib/payments";
const P = await import(`${B}/pricing.ts`);
const PAY = await import(`${B}/payments.ts`);
const C = await import(`${B}/checkin.ts`);
const REG = await import(`${B}/registrations.ts`);
const SET = await import(`${B}/settings.ts`);

const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const ACTOR = "topup-sweep@local";
const CODES = ["R-TQAA", "R-TQAB", "R-TQAC", "R-TQAD"];
const PHONE = "5559990000";

let pass = 0, fail = 0;
const t = (n: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${n.padEnd(50)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};
const read = async (c: string) => (await (await fetch(`${U}/registrations?code=eq.${c}&select=*`, { headers: H })).json())[0];
const make = async (c: string, o: Record<string, unknown>) => {
  const res = await fetch(`${U}/registrations`, { method: "POST", headers: H, body: JSON.stringify({ code: c, name: "TopUp Tester", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0, amount_due: 0, status: "PENDING", created_by: "topup-sweep", ...o }) });
  if (!res.ok) throw new Error(`${c}: ${await res.text()}`);
};

try {
  console.log("== THE BALANCE ITSELF ==");
  t("nothing paid", P.outstanding({ amount_due: 20, amount_received: null }), 20);
  t("part paid", P.outstanding({ amount_due: 35, amount_received: 20 }), 15);
  t("settled", P.outstanding({ amount_due: 20, amount_received: 20 }), 0);
  t("overpaid never negative", P.outstanding({ amount_due: 20, amount_received: 25 }), 0);
  t("cents", P.outstanding({ amount_due: 35.55, amount_received: 20.3 }), 15.25);

  const s = await SET.getSettings();

  console.log("\n== A PAID TICKET, THEN COUPONS ADDED TO THE SAME CODE ==");
  await make("R-TQAA", { adults: 1, amount_due: 20, amount_received: 20, status: "PAID", payment_method: "zelle", paid_at: new Date().toISOString() });
  let row = REG.parseRegistration ? await read("R-TQAA") : await read("R-TQAA");
  t("starts settled", P.outstanding(row), 0);

  const added = await REG.addToRegistration(
    { ...row, amount_due: Number(row.amount_due), amount_received: Number(row.amount_received), donation: Number(row.donation) },
    { name: "TopUp Tester", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 10, donation: 0, comment: "", announcements_opt_in: false },
    s, ACTOR
  );
  row = await read("R-TQAA");
  t("code unchanged", row.code, "R-TQAA");
  t("coupons now on the row", Number(row.coupons_qty), 10);
  t("bill grew by the bundle price", Number(row.amount_due), 35);
  t("already paid is untouched", Number(row.amount_received), 20);
  t("balance is the difference", P.outstanding(row), 15);
  t("still PAID, ticket keeps working", row.status, "PAID");

  console.log("\n== OWING MONEY HOLDS BACK EVERYTHING, NOT JUST THE COUPONS ==");
  let r = await C.checkIn("R-TQAA", "", ACTOR);
  t("entry refused while owing", r.outcome, "not_paid");
  t("says how much", /\$15\.00/.test(r.message), true);
  t("no wristband stamp written", !!(await read("R-TQAA")).checked_in_at, false);
  r = await C.collectCoupons("R-TQAA", ACTOR);
  t("coupons refused too", r.outcome, "not_paid");

  console.log("\n== THE TOP-UP PAYMENT MATCHES THE BALANCE, NOT THE TOTAL ==");
  const parsed = { amount: 15, sender_name: "TopUp Tester", confirmation: `TU-${Date.now()}`, memo_raw: "R-TQAA" };
  const payRow = await PAY.recordPayment(parsed, new Date().toISOString(), "admin", null, s);
  t("matched", payRow.match_status, "MATCHED");
  t("linked to the right code", payRow.linked_code, "R-TQAA");
  const applied = await PAY.applyPayment(payRow, ACTOR, s);
  row = await read("R-TQAA");
  t("credit added, not overwritten", Number(row.amount_received), 35);
  t("balance cleared", P.outstanding(row), 0);
  t("applied returned the row", applied?.code, "R-TQAA");

  console.log("\n== THE SAME PAYMENT CANNOT BE CREDITED TWICE ==");
  const again = await PAY.applyPayment(payRow, ACTOR, s);
  row = await read("R-TQAA");
  t("second apply does nothing", again, null);
  t("still 35, not 50", Number(row.amount_received), 35);

  console.log("\n== AND NOW THE COUPONS CAN BE HANDED OVER ==");
  r = await C.collectCoupons("R-TQAA", ACTOR);
  t("released once settled", r.outcome, "collected");

  console.log("\n== A SHORT PAYMENT AGAINST A BALANCE ==");
  await make("R-TQAB", { adults: 1, coupons_qty: 10, amount_due: 35, amount_received: 20, status: "PAID", payment_method: "zelle", paid_at: new Date().toISOString() });
  const short = await PAY.recordPayment({ amount: 5, sender_name: "TopUp Tester", confirmation: `TU2-${Date.now()}`, memo_raw: "R-TQAB" }, new Date().toISOString(), "admin", null, s);
  t("short of the balance is a mismatch", short.match_status, "AMOUNT_MISMATCH");
  t("still linked so it is not lost", short.linked_code, "R-TQAB");
  t("not applied", await PAY.applyPayment(short, ACTOR, s), null);
  t("nothing credited", Number((await read("R-TQAB")).amount_received), 20);

  console.log("\n== OVERPAYING A BALANCE ==");
  await make("R-TQAC", { adults: 1, coupons_qty: 10, amount_due: 35, amount_received: 20, status: "PAID", payment_method: "zelle", paid_at: new Date().toISOString() });
  const over = await PAY.recordPayment({ amount: 25, sender_name: "TopUp Tester", confirmation: `TU3-${Date.now()}`, memo_raw: "R-TQAC" }, new Date().toISOString(), "admin", null, s);
  t("more than owed still matches", over.match_status, "MATCHED");
  await PAY.applyPayment(over, ACTOR, s);
  row = await read("R-TQAC");
  t("everything received is recorded", Number(row.amount_received), 45);
  t("balance floors at zero", P.outstanding(row), 0);
  t("overpayment noted for the treasurer", /OVERPAID by \$10\.00/.test(row.notes), true);

  console.log("\n== A SETTLED CODE IGNORES A STRAY PAYMENT ==");
  await make("R-TQAD", { adults: 1, amount_due: 20, amount_received: 20, status: "PAID", payment_method: "zelle", paid_at: new Date().toISOString() });
  const stray = await PAY.recordPayment({ amount: 20, sender_name: "Someone Else", confirmation: `TU4-${Date.now()}`, memo_raw: "R-TQAD" }, new Date().toISOString(), "admin", null, s);
  t("nothing owed, so no match", stray.match_status, "UNMATCHED");
  t("not credited", Number((await read("R-TQAD")).amount_received), 20);

  console.log("\n== WHO A TOP-UP IS ALLOWED TO JOIN ==");
  const target = await REG.findTopUpTarget({ name: "TopUp Tester", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 5, donation: 0, comment: "", announcements_opt_in: false });
  t("same name and phone finds a settled row", CODES.includes(target?.code ?? ""), true);
  const other = await REG.findTopUpTarget({ name: "A Different Person", phone: PHONE, email: "", adults: 1, youth: 0, children: 0, coupons_qty: 0, donation: 0, comment: "", announcements_opt_in: false });
  t("different name on the same phone does NOT join", other, null);
  const noPhone = await REG.findTopUpTarget({ name: "TopUp Tester", phone: "", email: "", adults: 1, youth: 0, children: 0, coupons_qty: 0, donation: 0, comment: "", announcements_opt_in: false });
  t("no phone, no joining", noPhone, null);
  const stranger = await REG.findTopUpTarget({ name: "Nobody At All", phone: "5550001111", email: "", adults: 1, youth: 0, children: 0, coupons_qty: 0, donation: 0, comment: "", announcements_opt_in: false });
  t("a stranger starts fresh", stranger, null);
} catch (err) {
  fail++;
  console.log(`\n  !! THREW: ${err instanceof Error ? err.stack : String(err)}`);
} finally {
  console.log("\n== CLEAN UP ==");
  for (const c of CODES) {
    await fetch(`${U}/payments?linked_code=eq.${c}`, { method: "DELETE", headers: H });
    await fetch(`${U}/registrations?code=eq.${c}`, { method: "DELETE", headers: H });
  }
  await fetch(`${U}/payments?sender_name=eq.TopUp%20Tester`, { method: "DELETE", headers: H });
  await fetch(`${U}/payments?sender_name=eq.Someone%20Else`, { method: "DELETE", headers: H });
  await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}`, { method: "DELETE", headers: H });
  await fetch(`${U}/audit_log?actor=eq.web`, { method: "DELETE", headers: H });
  const left = await (await fetch(`${U}/registrations?phone=eq.${PHONE}&select=code`, { headers: H })).json();
  t("throwaway rows removed", left.length, 0);
  const regs = await fetch(`${U}/registrations?select=code`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  console.log(`  .. registrations now: ${regs.headers.get("content-range")}`);
  console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
