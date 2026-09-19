// The case my earlier suite missed: paying a row that nobody has paid yet,
// where amount_received is null rather than zero. Both routes, admin and
// automatic. Throwaway rows, deleted at the end.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const B = "@/lib/payments";
const P = await import(`${B}/pricing.ts`);
const PAY = await import(`${B}/payments.ts`);
const REG = await import(`${B}/registrations.ts`);
const SET = await import(`${B}/settings.ts`);

const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const ACTOR = "firstpay-sweep@local";
const CODES = ["R-FPAA", "R-FPAB", "R-FPAC"];
const PHONE = "5559992222";

let pass = 0, fail = 0;
const t = (n: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${n.padEnd(54)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};
const read = async (c: string) => (await (await fetch(`${U}/registrations?code=eq.${c}&select=*`, { headers: H })).json())[0];
const make = async (c: string, o: Record<string, unknown> = {}) => {
  const res = await fetch(`${U}/registrations`, { method: "POST", headers: H, body: JSON.stringify({ code: c, name: "FirstPay Tester", phone: PHONE, email: "", adults: 1, youth: 0, children: 0, coupons_qty: 0, donation: 0, amount_due: 20, status: "PENDING", created_by: "firstpay-sweep", is_test: true, ...o }) });
  if (!res.ok) throw new Error(`${c}: ${await res.text()}`);
};

try {
  const s = await SET.getSettings();

  console.log("== THE ROW STARTS WITH NULL, NOT ZERO ==");
  await make("R-FPAA");
  t("nothing received yet is null", (await read("R-FPAA")).amount_received, null);
  t("balance reads as the whole bill", P.outstanding(await read("R-FPAA")), 20);

  console.log("\n== ADMIN MARK PAID ON A NEVER-PAID ROW ==");
  const res = await REG.markPaid("R-FPAA", { method: "cash", amount: 20, note: "" }, ACTOR);
  t("it succeeds", res.row.status, "PAID");
  let row = await read("R-FPAA");
  t("credited", Number(row.amount_received), 20);
  t("balance cleared", P.outstanding(row), 0);
  t("method recorded", row.payment_method, "cash");

  console.log("\n== MARKING IT PAID TWICE ==");
  let threw = "";
  try { await REG.markPaid("R-FPAA", { method: "cash", amount: 20, note: "" }, ACTOR); }
  catch (e) { threw = e instanceof Error ? e.message : String(e); }
  t("refused, nothing owing", /already PAID/i.test(threw), true);
  t("still 20, not 40", Number((await read("R-FPAA")).amount_received), 20);

  console.log("\n== AUTOMATIC ZELLE ON A NEVER-PAID ROW ==");
  await make("R-FPAB");
  const payRow = await PAY.recordPayment(
    { amount: 20, sender_name: "FirstPay Tester", confirmation: `FP-${Date.now()}`, memo_raw: "R-FPAB" },
    new Date().toISOString(), "admin", null, s
  );
  t("matched against the full bill", payRow.match_status, "MATCHED");
  const applied = await PAY.applyPayment(payRow, ACTOR, s);
  t("applied without error", applied?.code, "R-FPAB");
  row = await read("R-FPAB");
  t("credited from null", Number(row.amount_received), 20);
  t("now PAID", row.status, "PAID");
  t("balance cleared", P.outstanding(row), 0);

  console.log("\n== A SHORT FIRST PAYMENT STILL BEHAVES ==");
  await make("R-FPAC");
  const short = await PAY.recordPayment(
    { amount: 5, sender_name: "FirstPay Tester", confirmation: `FP2-${Date.now()}`, memo_raw: "R-FPAC" },
    new Date().toISOString(), "admin", null, s
  );
  t("short of the bill is a mismatch", short.match_status, "AMOUNT_MISMATCH");
  t("not applied", await PAY.applyPayment(short, ACTOR, s), null);
  t("still null, nothing credited", (await read("R-FPAC")).amount_received, null);
  t("still owes the lot", P.outstanding(await read("R-FPAC")), 20);

  console.log("\n== AND THE PARTIAL CAN BE SETTLED BY HAND AFTERWARDS ==");
  const res2 = await REG.markPaid("R-FPAC", { method: "cash", amount: 20, note: "paid at the desk" }, ACTOR);
  t("desk payment succeeds", res2.row.status, "PAID");
  t("credited", Number((await read("R-FPAC")).amount_received), 20);

  // The database, not the application, is what stops two people being handed
  // the same code. Checked here because this suite owns a row to collide
  // with. It used to live in suite-db pointed at a real registration by name,
  // so the day that registration was cleared it stopped colliding, was
  // accepted, and left a stray row in the table.
  console.log("\n== THE SAME CODE CANNOT BE ISSUED TWICE ==");
  const clash = await fetch(`${U}/registrations`, {
    method: "POST", headers: H,
    body: JSON.stringify({ code: "R-FPAC", name: "Someone Else", phone: "5550009999", email: "", adults: 1, youth: 0, children: 0, coupons_qty: 0, donation: 0, amount_due: 20, status: "PENDING", created_by: "firstpay-sweep", is_test: true }),
  });
  const clashBody = await clash.text();
  t("a second row with the same code is refused", clash.ok, false);
  t("and the database says why", /duplicate|unique/i.test(clashBody), true);
  t("the original is untouched", Number((await read("R-FPAC")).amount_received), 20);
} catch (err) {
  fail++;
  console.log(`\n  !! THREW: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  console.log("\n== CLEAN UP ==");
  for (const c of CODES) {
    await fetch(`${U}/payments?linked_code=eq.${c}`, { method: "DELETE", headers: H });
    await fetch(`${U}/registrations?code=eq.${c}`, { method: "DELETE", headers: H });
  }
  await fetch(`${U}/payments?sender_name=eq.FirstPay%20Tester`, { method: "DELETE", headers: H });
  await fetch(`${U}/audit_log?actor=eq.${encodeURIComponent(ACTOR)}`, { method: "DELETE", headers: H });
  const left = await (await fetch(`${U}/registrations?phone=eq.${PHONE}&select=code`, { headers: H })).json();
  t("throwaway rows removed", left.length, 0);
  const regs = await fetch(`${U}/registrations?select=code`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  console.log(`  .. registrations now: ${regs.headers.get("content-range")}`);
  console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
