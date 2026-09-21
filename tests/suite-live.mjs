// Live checks against production. Reads only.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const H = "https://bdutah.jotillabs.com";
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${String(name).padEnd(30)} ${JSON.stringify(got)}${okk ? "" : "  want " + JSON.stringify(want)}`);
};

console.log("== PRICING API ==");
const j = await (await fetch(`${H}/api/pricing`)).json();
const p = j.result.pricing;
t("adult", p.price_adult, 20);
t("youth", p.price_youth, 12);
t("child", p.price_child, 0);
t("coupon single", p.coupon_single, 2);
t("bundle qty", p.coupon_bundle_qty, 10);
t("bundle price", p.coupon_bundle_price, 15);
t("event time", p.event_time, "11:00 AM");
t("registration closes", p.registration_closes, "Sep 26, 2026");
t("registration open", j.result.registration_open, true);
t("zelle recipient name", p.zelle_recipient_name, "Md Shamim Ahmmed");
// Blank until the admin turns Venmo on in Settings. The key being present is
// what proves the Venmo code is deployed; the value is the switch.
t("venmo handle key exposed", typeof p.venmo_handle, "string");
console.log(`  venmo ${p.venmo_handle ? "ON: @" + p.venmo_handle : "off (handle blank)"}`);

console.log("\n== VENUE CONSISTENCY (settings vs the event row) ==");
const U = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdr = { apikey: key, Authorization: `Bearer ${key}` };
const [ev] = await (await fetch(`${U}/events?slug=eq.2026-salt-lake-city-bd-picnic&select=venue,address,city,date`, { headers: hdr })).json();
console.log(`  events.venue        ${JSON.stringify(ev.venue)}`);
console.log(`  events.address      ${JSON.stringify(ev.address)}`);
console.log(`  settings.event_venue ${JSON.stringify(p.event_venue)}`);
const pavilionEverywhere = /pavilion/i.test(p.event_venue);
console.log(`  ${pavilionEverywhere ? "ok  " : "MISMATCH"} the receipt venue ${pavilionEverywhere ? "names the pavilion" : "does NOT name the pavilion, unlike the event page"}`);
if (!pavilionEverywhere) fail++; else pass++;

console.log("\n== EVENT TIME AGREES ACROSS THE TWO SOURCES ==");
const utah = new Date(ev.date).toLocaleString("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit", hour12: true });
console.log(`  events.date -> Utah  ${utah}`);
t("matches settings event_time", utah.replace(/ /g, " "), p.event_time);

console.log("\n== EVENT PAGE CONTENT ==");
const page = await (await fetch(`${H}/events/2026-salt-lake-city-bd-picnic`)).text();
const has = (s) => page.includes(s);
t("shows 11:00 AM", has("11:00 AM"), true);
t("no stale 12:00 PM", has("12:00 PM"), false);
t("pavilion named", has("Pavilion 1"), true);
t("street address shown", has("4988 S Fork Rd"), true);
t("no wrong city", has("84604, Salt Lake City"), false);
t("schedule section", has("Schedule"), true);
// The running order is published, so "Coming soon" going missing is now the
// pass rather than the failure. These check the day is really on the page:
// its first and last blocks, an item from the middle, and the photograph
// behind it. If data/schedule.html is ever emptied these go red, which is
// the point — the page would silently fall back to the placeholder.
t("no longer says coming soon", has("Coming soon"), false);
t("first block", has("Check-in and Mingle"), true);
t("last block", has("Raffle and Closing"), true);
t("an item from the middle", has("Hari Bhanga"), true);
t("the 12:20 AM typo is corrected", has("12:20 PM") && !has("12:20 AM"), true);
t("photograph behind it", has("schedule-backdrop"), true);
t("bangla intact", has("আসুন"), true);
t("no mojibake", /\?{4,}/.test(page.replace(/\?\?/g, "")), false);
t("three fee bands", has("Adult (16+)") && has("Youth (10 to 16)") && has("Child (under 10)"), true);

console.log("\n== REGISTER PAGE CONTENT ==");
const reg = await (await fetch(`${H}/register`)).text();
const rhas = (s) => reg.includes(s);
// Since 21 September the donation is on by default at the minimum, the
// committee's choice, with the amount and the quick picks showing from the
// start. Before that it was off and the box hidden; these used to assert
// that, which is exactly backwards now.
t("donation on by default", rhas("Adding a donation"), true);
t("says what it pays for", rhas("Your donation covers the park"), true);
t("amount box shown from the start", rhas('id="reg-donation"'), true);
t("quick amounts offered", rhas("$100.00") && rhas("$200.00"), true);
t("no-memo safety net: nothing on the page promises confirmation without a code", rhas("without the code"), false);
t("adult band", rhas("16 and over, $20.00"), true);
t("youth band", rhas("10 to 16, $12.00"), true);
t("child free", rhas("Under 10, free"), true);
t("student link", rhas("facebook.com/BSAUofU"), true);
t("no student ticket type", rhas("Ticket type"), false);
t("bot trap present", rhas('name="website"'), true);
t("bot trap has no visible label", /<label[^>]*>\s*Website/i.test(reg), false);

console.log("\n== ASSISTANT ORBS ==");
const home = await (await fetch(`${H}/`)).text();
t("voice orb", home.includes("Talk to us"), true);
t("call link", home.includes('href="tel:+18669307859"'), true);
t("orb waves", (home.match(/orb-wave/g) || []).length >= 3, true);
const chunk = home.match(/\/_next\/static\/chunks\/app\/layout-[a-z0-9]+\.js/)?.[0];
const js = await (await fetch(`${H}${chunk}`)).text();
t("retell key shipped", js.includes("public_key_"), true);
t("voice agent id", js.includes("agent_6525c1227b057c8336482a3668"), true);
t("chat agent id", js.includes("agent_e4ee635091b0cc85b835fae810"), true);
t("sms link", js.includes("sms:"), true);
t("avatar url", js.includes("/assistant.jpg"), true);
t("circular avatar rule", js.includes("_inlineLogo"), true);

console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
