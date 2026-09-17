// Proves the database refuses bad data on its own, independently of the app.
// Every insert here is expected to be rejected, so nothing is created.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdr = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
let pass = 0, fail = 0;

const good = { name: "constraint probe", amount_due: 0, created_by: "test-sweep" };
async function refuses(name, patch, expect) {
  const res = await fetch(`${U}/registrations`, {
    method: "POST", headers: hdr,
    body: JSON.stringify({ code: `X-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, ...good, ...patch }),
  });
  const body = await res.json().catch(() => ({}));
  const refused = !res.ok;
  const right = refused && (!expect || new RegExp(expect, "i").test(JSON.stringify(body)));
  right ? pass++ : fail++;
  console.log(`  ${right ? "ok  " : "FAIL"} ${name.padEnd(38)} ${refused ? "refused" : "!! ACCEPTED, a row may exist"}`);
  if (!refused && body.code) {
    await fetch(`${U}/registrations?code=eq.${body.code}`, { method: "DELETE", headers: hdr });
    console.log("       (created row deleted again)");
  }
}

console.log("== DATABASE CONSTRAINTS ==");
await refuses("youth above 50", { youth: 51 }, "youth_check");
await refuses("youth negative", { youth: -1 }, "youth_check");
await refuses("adults above 50", { adults: 51 }, "adults_check");
await refuses("children negative", { children: -3 }, "children_check");
await refuses("coupons above 500", { coupons_qty: 501 }, "coupons_qty_check");
await refuses("negative donation", { donation: -10 }, "donation_check");
await refuses("negative amount due", { amount_due: -1 }, "amount_due_check");
await refuses("invented status", { status: "BANANA" }, "status_check");
await refuses("invented payment method", { payment_method: "bitcoin" }, "payment_method_check");
await refuses("duplicate code", { code: "R-8E3U" }, "duplicate|unique");

console.log("\n== COLUMNS THE APP DEPENDS ON ==");
const cols = ["code", "name", "phone", "email", "adults", "youth", "children", "coupons_qty", "donation", "amount_due", "amount_received", "status", "payment_method", "paid_at", "checked_in_at", "checked_in_by", "coupons_collected_at", "coupons_collected_by", "zelle_confirmation_id", "receipt_sent_at", "code_sms_at", "ticket_sms_at"];
const r = await fetch(`${U}/registrations?select=${cols.join(",")}&limit=1`, { headers: hdr });
const okCols = r.ok;
okCols ? pass++ : fail++;
console.log(`  ${okCols ? "ok  " : "FAIL"} all ${cols.length} columns readable${okCols ? "" : ": " + JSON.stringify(await r.json())}`);

// What matters is the value the app ends up using, not whether the row
// happens to exist: a key absent from the table is filled from the code
// defaults, and that is a normal, working state. So check the effective
// value, and say which of the two it came from.
console.log("\n== SETTINGS THE APP READS ==");
const settings = await (await fetch(`${U}/payment_settings?select=key,value`, { headers: hdr })).json();
const bykey = Object.fromEntries(settings.map((s) => [s.key, s.value]));
const effective = await (await import("@/lib/payments/settings")).getSettings();
for (const k of ["price_adult", "price_youth", "price_child", "coupon_single", "coupon_bundle_qty", "coupon_bundle_price", "event_time", "event_date", "registration_closes", "registration_open", "zelle_recipient", "zelle_recipient_name", "auto_confirm", "sms_enabled"]) {
  const stored = k in bykey && String(bykey[k]).trim() !== "";
  const value = effective[k];
  const usable = value !== undefined && value !== null && String(value).trim() !== "";
  usable ? pass++ : fail++;
  const from = stored ? "" : "  (from the code default, not the table)";
  console.log(`  ${usable ? "ok  " : "FAIL"} ${k.padEnd(24)} ${JSON.stringify(value)}${from}`);
}
const dead = Object.keys(bykey).filter((k) => k === "price_student");
console.log(dead.length ? `  ..   leftover unused key: ${dead.join(", ")}` : "  ..   no leftover keys");

console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
