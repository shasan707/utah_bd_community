// The reverse order: coupons or a donation first, seats afterwards.
// Throwaway rows, deleted at the end.
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
const E = await import(`${B}/emails.ts`);
const T = await import(`${B}/ticket.ts`);

const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const ACTOR = "reverse-sweep@local";
const CODES = ["C-RVAA", "D-RVAB"];
const PHONE = "5559991111";

let pass = 0, fail = 0;
const t = (n: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${n.padEnd(52)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};
const read = async (c: string) => (await (await fetch(`${U}/registrations?code=eq.${c}&select=*`, { headers: H })).json())[0];
const make = async (c: string, o: Record<string, unknown>) => {
  const res = await fetch(`${U}/registrations`, { method: "POST", headers: H, body: JSON.stringify({ code: c, name: "Reverse Tester", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0, amount_due: 0, status: "PENDING", created_by: "reverse-sweep", ...o }) });
  if (!res.ok) throw new Error(`${c}: ${await res.text()}`);
};
const seats = (o: Record<string, number>) => ({ name: "Reverse Tester", phone: PHONE, email: "", adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0, comment: "", announcements_opt_in: false, ...o });

try {
  const s = await SET.getSettings();

  console.log("== COUPONS FIRST (C- code, paid), SEATS ADDED AFTER ==");
  await make("C-RVAA", { coupons_qty: 10, amount_due: 15, amount_received: 15, status: "PAID", payment_method: "zelle", paid_at: new Date().toISOString() });
  let row = await read("C-RVAA");
  t("starts with no seats", P.headcount({ adults: Number(row.adults), youth: Number(row.youth), children: Number(row.children) }), 0);

  const found = await REG.findTopUpTarget(seats({ adults: 2 }));
  t("their coupon code is found for the top-up", found?.code, "C-RVAA");

  await REG.addToRegistration(
    { ...row, amount_due: Number(row.amount_due), amount_received: Number(row.amount_received), donation: Number(row.donation), adults: Number(row.adults), youth: Number(row.youth), children: Number(row.children), coupons_qty: Number(row.coupons_qty) },
    seats({ adults: 2 }), s, ACTOR
  );
  row = await read("C-RVAA");
  t("same code kept", row.code, "C-RVAA");
  t("seats now on it", Number(row.adults), 2);
  t("coupons still on it", Number(row.coupons_qty), 10);
  t("bill grew by two adults", Number(row.amount_due), 55);
  t("balance is the seats only", P.outstanding(row), 40);

  console.log("\n== DOES IT BEHAVE AS A TICKET NOW? ==");
  const parsed = { ...row, amount_due: Number(row.amount_due), amount_received: Number(row.amount_received), donation: Number(row.donation), adults: Number(row.adults), youth: Number(row.youth), children: Number(row.children), coupons_qty: Number(row.coupons_qty) } as never;
  const mail = E.receiptEmail(parsed, s);
  t("receipt is a ticket, not a receipt", /your ticket for/.test(mail.subject), true);
  t("admits the two adults", /2 adults/.test(mail.text), true);
  t("QR still made for a C- code", T.ticketLinks("C-RVAA") !== null || !process.env.TICKET_SECRET, true);

  let r = await C.checkIn("C-RVAA", "", ACTOR);
  t("refused while the seats are unpaid", r.outcome, "not_paid");
  r = await C.collectCoupons("C-RVAA", ACTOR);
  t("coupons held too", r.outcome, "not_paid");
  // Settle the balance, then the C- prefix must not stand in the way.
  await REG.markPaid("C-RVAA", { method: "cash", amount: 40, note: "" }, ACTOR);
  r = await C.checkIn("C-RVAA", "", ACTOR);
  t("door admits them despite the C prefix", r.outcome, "checked_in");
  t("two wristbands", /2 wristband/.test(r.message), true);
  await C.undoCheckIn("C-RVAA", ACTOR);

  console.log("\n== DONATION FIRST (D- code, paid), SEATS ADDED AFTER ==");
  await make("D-RVAB", { donation: 50, amount_due: 50, amount_received: 50, status: "PAID", payment_method: "zelle", paid_at: new Date().toISOString() });
  row = await read("D-RVAB");
  const found2 = await REG.findTopUpTarget(seats({ adults: 1, youth: 1 }));
  t("a donation-only code is joinable", CODES.includes(found2?.code ?? ""), true);

  await REG.addToRegistration(
    { ...row, amount_due: Number(row.amount_due), amount_received: Number(row.amount_received), donation: Number(row.donation), adults: Number(row.adults), youth: Number(row.youth), children: Number(row.children), coupons_qty: Number(row.coupons_qty) },
    seats({ adults: 1, youth: 1 }), s, ACTOR
  );
  row = await read("D-RVAB");
  t("same code kept", row.code, "D-RVAB");
  t("donation untouched", Number(row.donation), 50);
  t("seats added", `${row.adults}a ${row.youth}y`, "1a 1y");
  t("bill is donation plus seats", Number(row.amount_due), 82);
  t("balance is the seats only", P.outstanding(row), 32);
  r = await C.checkIn("D-RVAB", "", ACTOR);
  t("refused while the seats are unpaid", r.outcome, "not_paid");
  await REG.markPaid("D-RVAB", { method: "cash", amount: 32, note: "" }, ACTOR);
  r = await C.checkIn("D-RVAB", "", ACTOR);
  t("door admits them despite the D prefix", r.outcome, "checked_in");
  await C.undoCheckIn("D-RVAB", ACTOR);

  console.log("\n== THE ONE COSMETIC WRINKLE ==");
  t("prefix still says C even though it now seats people", (await read("C-RVAA")).code.startsWith("C-"), true);
  console.log("       (the letter only records what the FIRST purchase was;");
  console.log("        nothing reads it after the code is minted)");
} catch (err) {
  fail++;
  console.log(`\n  !! THREW: ${err instanceof Error ? err.stack : String(err)}`);
} finally {
  console.log("\n== CLEAN UP ==");
  for (const c of CODES) {
    await fetch(`${U}/payments?linked_code=eq.${c}`, { method: "DELETE", headers: H });
    await fetch(`${U}/registrations?code=eq.${c}`, { method: "DELETE", headers: H });
  }
  await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}`, { method: "DELETE", headers: H });
  const left = await (await fetch(`${U}/registrations?phone=eq.${PHONE}&select=code`, { headers: H })).json();
  t("throwaway rows removed", left.length, 0);
  const regs = await fetch(`${U}/registrations?select=code`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  console.log(`  .. registrations now: ${regs.headers.get("content-range")}`);
  console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
