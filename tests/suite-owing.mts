// Replays the real D-TYVA sequence that produced a split code and free
// entry: donation paid in cash, seats added afterwards, then a second visit.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const B = "@/lib/payments";
const P = await import(`${B}/pricing.ts`);
const C = await import(`${B}/checkin.ts`);
const REG = await import(`${B}/registrations.ts`);
const SET = await import(`${B}/settings.ts`);

const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const ACTOR = "owing-sweep@local";
const CODE = "D-QWAA";
const PHONE = "5559993333";

let pass = 0, fail = 0;
const t = (n: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${n.padEnd(56)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};
const read = async (c: string) => (await (await fetch(`${U}/registrations?code=eq.${c}&select=*`, { headers: H })).json())[0];
const typed = (r: Record<string, unknown>) => ({ ...r, amount_due: Number(r.amount_due), amount_received: r.amount_received === null ? null : Number(r.amount_received), donation: Number(r.donation), adults: Number(r.adults), youth: Number(r.youth), children: Number(r.children), coupons_qty: Number(r.coupons_qty) }) as never;
const order = (o: Record<string, number>) => ({ name: "Anis Khan", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0, comment: "", announcements_opt_in: false, ...o });

try {
  const s = await SET.getSettings();

  console.log("== A DONATION, PAID IN CASH AT THE DESK ==");
  await fetch(`${U}/registrations`, { method: "POST", headers: H, body: JSON.stringify({ code: CODE, name: "Anis Khan", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 50, amount_due: 50, status: "PENDING", created_by: "owing-sweep", is_test: true }) });
  await REG.markPaid(CODE, { method: "cash", amount: 50, note: "" }, ACTOR);
  let row = await read(CODE);
  t("settled", row.status, "PAID");
  t("nothing owing", P.outstanding(row), 0);

  console.log("\n== THEN THEY ADD SEATS AND A COUPON ==");
  await REG.addToRegistration(typed(row), order({ adults: 1, children: 1, coupons_qty: 1 }), s, ACTOR);
  row = await read(CODE);
  t("same code", row.code, CODE);
  t("bill grew", Number(row.amount_due), 72);
  t("balance is the new part", P.outstanding(row), 22);

  console.log("\n== THE DOOR MUST NOT LET THEM IN FOR FREE ==");
  let r = await C.checkIn(CODE, "", ACTOR);
  t("entry refused while owing", r.outcome, "not_paid");
  t("says the amount", /\$22\.00/.test(r.message), true);
  t("no wristband stamp written", !!(await read(CODE)).checked_in_at, false);
  r = await C.collectCoupons(CODE, ACTOR);
  t("coupons refused too", r.outcome, "not_paid");

  console.log("\n== A SECOND VISIT JOINS THE SAME CODE, NOT A NEW ONE ==");
  const target = await REG.findTopUpTarget(order({ youth: 1 }), true);
  t("their owing code is joinable now", target?.code, CODE);
  await REG.addToRegistration(typed(await read(CODE)), order({ youth: 1 }), s, ACTOR);
  row = await read(CODE);
  t("still one code", row.code, CODE);
  t("bill grew again", Number(row.amount_due), 84);
  t("balance accumulated", P.outstanding(row), 34);

  console.log("\n== PAYING PART OF IT DOES NOT MARK IT SETTLED ==");
  await REG.markPaid(CODE, { method: "cash", amount: 10, note: "part payment" }, ACTOR);
  row = await read(CODE);
  t("credited", Number(row.amount_received), 60);
  t("still owes the rest", P.outstanding(row), 24);
  t("NOT marked paid", row.status, "PENDING");
  r = await C.checkIn(CODE, "", ACTOR);
  t("still refused at the door", r.outcome, "not_paid");

  console.log("\n== PAYING THE REST SETTLES IT AND RELEASES EVERYTHING ==");
  await REG.markPaid(CODE, { method: "cash", amount: 24, note: "balance" }, ACTOR);
  row = await read(CODE);
  t("fully credited", Number(row.amount_received), 84);
  t("nothing owing", P.outstanding(row), 0);
  t("now PAID", row.status, "PAID");
  r = await C.checkIn(CODE, "", ACTOR);
  t("admitted at last", r.outcome, "checked_in");
  t("three wristbands", /3 wristband/.test(r.message), true);
  r = await C.collectCoupons(CODE, ACTOR);
  t("coupons released", r.outcome, "collected");

  console.log("\n== AND IT STILL REFUSES TO OVERPAY A SETTLED CODE ==");
  let threw = "";
  try { await REG.markPaid(CODE, { method: "cash", amount: 10, note: "" }, ACTOR); }
  catch (e) { threw = e instanceof Error ? e.message : String(e); }
  t("refused once settled", /already PAID/i.test(threw), true);
} catch (err) {
  fail++;
  console.log(`\n  !! THREW: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  console.log("\n== CLEAN UP ==");
  await fetch(`${U}/payments?linked_code=eq.${CODE}`, { method: "DELETE", headers: H });
  await fetch(`${U}/registrations?code=eq.${CODE}`, { method: "DELETE", headers: H });
  await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}`, { method: "DELETE", headers: H });
  const left = await (await fetch(`${U}/registrations?phone=eq.${PHONE}&select=code`, { headers: H })).json();
  t("throwaway row removed", left.length, 0);
  console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
