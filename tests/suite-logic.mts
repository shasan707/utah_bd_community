// Read-only test sweep over the real modules. Creates nothing, sends nothing.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

const B = "@";
const P = await import(`${B}/lib/payments/pricing.ts`);
const Z = await import(`${B}/lib/payments/zelle-parse.ts`);
const D = await import(`${B}/lib/payments/dates.ts`);
const A = await import(`${B}/lib/address.ts`);
const R = await import(`${B}/lib/payments/registrations.ts`);

let pass = 0, fail = 0;
const results: string[] = [];
function ok(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; results.push(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}
function okTrue(name: string, cond: boolean) { ok(name, !!cond, true); }
function throws(name: string, fn: () => unknown, mustSay?: RegExp) {
  try { fn(); fail++; results.push(`  FAIL ${name}: expected a rejection, none thrown`); }
  catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (mustSay && !mustSay.test(m)) { fail++; results.push(`  FAIL ${name}: wrong message "${m}"`); }
    else pass++;
  }
}

const prices = { price_adult: 20, price_youth: 12, price_child: 0, coupon_single: 2, coupon_bundle_qty: 10, coupon_bundle_price: 15 };
const items = (o: Partial<Record<string, number>> = {}) => ({ adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0, ...o });

console.log("\n== PRICING ==");
ok("1 adult", P.computeAmount(items({ adults: 1 }), prices), 20);
ok("16+ band is adult price", P.computeAmount(items({ adults: 3 }), prices), 60);
ok("youth 10-16 at 12", P.computeAmount(items({ youth: 1 }), prices), 12);
ok("under 10 free", P.computeAmount(items({ children: 9 }), prices), 0);
ok("family mixed", P.computeAmount(items({ adults: 2, youth: 1, children: 3 }), prices), 52);
ok("9 coupons at single", P.computeAmount(items({ coupons_qty: 9 }), prices), 18);
ok("10 coupons = bundle rate", P.computeAmount(items({ coupons_qty: 10 }), prices), 15);
ok("11 coupons = bundle + 1", P.computeAmount(items({ coupons_qty: 11 }), prices), 17);
ok("20 coupons = 2 bundles", P.computeAmount(items({ coupons_qty: 20 }), prices), 30);
ok("nobody overpays at 10", P.computeAmount(items({ coupons_qty: 10 }), prices) <= 10 * prices.coupon_single, true);
ok("donation adds", P.computeAmount(items({ adults: 1, donation: 50 }), prices), 70);
ok("everything", P.computeAmount(items({ adults: 2, youth: 1, children: 2, coupons_qty: 10, donation: 50 }), prices), 117);
ok("cents rounded", P.computeAmount(items({ donation: 50.555 }), prices), 50.56);
ok("zero total", P.computeAmount(items(), prices), 0);

console.log("== HEADCOUNT / PARTY ==");
ok("headcount sums three bands", P.headcount({ adults: 2, youth: 1, children: 3 }), 6);
ok("headcount ignores coupons", P.headcount({ adults: 0, youth: 0, children: 0 }), 0);
ok("party singular", P.partySummary({ adults: 1, youth: 0, children: 0 }), "1 adult");
ok("party plural + youth", P.partySummary({ adults: 2, youth: 1, children: 1 }), "2 adults, 1 youth, 1 child");
ok("party children plural", P.partySummary({ adults: 0, youth: 0, children: 4 }), "4 children");
ok("party empty", P.partySummary({ adults: 0, youth: 0, children: 0 }), "");

console.log("== CODE PREFIX ==");
ok("seats -> R", P.codePrefix(items({ adults: 1, coupons_qty: 5, donation: 50 })), "R");
ok("coupons only -> C", P.codePrefix(items({ coupons_qty: 5 })), "C");
ok("coupons+donation, no seats -> C", P.codePrefix(items({ coupons_qty: 5, donation: 50 })), "C");
ok("donation only -> D", P.codePrefix(items({ donation: 50 })), "D");
ok("youth counts as seats", P.codePrefix(items({ youth: 1 })), "R");

console.log("== DONATION MINIMUM ==");
ok("constant is 50", P.DONATION_MIN, 50);
const base = { name: "Test Person", phone: "5551234567", email: "t@example.com", adults: 1 };
okTrue("web: no donation ok", !!R.validateRegistrationInput({ ...base }, "web"));
okTrue("web: exactly 50 ok", !!R.validateRegistrationInput({ ...base, donation: 50 }, "web"));
okTrue("web: 500 ok", !!R.validateRegistrationInput({ ...base, donation: 500 }, "web"));
throws("web: 49.99 refused", () => R.validateRegistrationInput({ ...base, donation: 49.99 }, "web"), /at least/i);
throws("web: 1 refused", () => R.validateRegistrationInput({ ...base, donation: 1 }, "web"), /at least/i);
throws("web: 25 refused", () => R.validateRegistrationInput({ ...base, donation: 25 }, "web"), /at least/i);
okTrue("admin: 20 allowed", !!R.validateRegistrationInput({ ...base, donation: 20 }, "admin"));

console.log("== OTHER VALIDATION ==");
throws("name required", () => R.validateRegistrationInput({ adults: 1 }, "web"), /name/i);
throws("web needs phone", () => R.validateRegistrationInput({ name: "A", email: "t@e.com", adults: 1 }, "web"), /phone/i);
throws("web needs valid email", () => R.validateRegistrationInput({ name: "A", phone: "555", email: "nope", adults: 1 }, "web"), /email/i);
throws("nothing selected", () => R.validateRegistrationInput({ ...base, adults: 0 }, "web"), /nothing selected/i);
okTrue("coupons only, no people, allowed", !!R.validateRegistrationInput({ ...base, adults: 0, coupons_qty: 5 }, "web"));
okTrue("donation only, no people, allowed", !!R.validateRegistrationInput({ ...base, adults: 0, donation: 50 }, "web"));
ok("adults clamped to 50", R.validateRegistrationInput({ ...base, adults: 9999 }, "web").adults, 50);
ok("youth clamped to 50", R.validateRegistrationInput({ ...base, youth: 9999 }, "web").youth, 50);
ok("negative becomes 0", R.validateRegistrationInput({ ...base, adults: 1, children: -5 }, "web").children, 0);
ok("phone stripped to digits", R.validateRegistrationInput({ ...base, phone: "(555) 123-4567" }, "web").phone, "5551234567");
ok("email lowercased", R.validateRegistrationInput({ ...base, email: "T@Example.COM" }, "web").email, "t@example.com");

console.log("== ZELLE MEMO MATCHING ==");
const cand = (m: string) => [...Z.extractCandidates(m)];
okTrue("exact code", cand("R-W7RU").includes("RW7RU"));
okTrue("lowercase", cand("r-w7ru").includes("RW7RU"));
okTrue("no hyphen", cand("RW7RU").includes("RW7RU"));
okTrue("space instead", cand("R W7RU").includes("RW7RU"));
okTrue("inside a sentence", cand("picnic R-W7RU thanks").includes("RW7RU"));
okTrue("body alone matches", cand("W7RU").includes("W7RU"));
okTrue("C code", cand("C-8K2P").includes("C8K2P"));
okTrue("D code", cand("D-3QW9").includes("D3QW9"));
okTrue("unrelated memo has no code", !cand("Bear lake trip").includes("RW7RU"));
okTrue("one-char typo detected", Z.memoNearCode("R-PQ2Q", "R-PQ2G"));
okTrue("two-char typo not accepted", !Z.memoNearCode("R-PQ11", "R-PQ2G"));

console.log("== BANK EMAIL PARSING ==");
const boa = ["Bank of America.", "", "Qudratealahy Ratul sent you $24.00", "", "R-W7RU", "", "View your balance", "", "Zelle\u00ae and the Zelle\u00ae related marks are wholly owned by Early Warning Services, LLC."].join("\n");
const p1 = Z.parseZelleEmail(boa, "Qudratealahy Ratul sent you $24.00", "msg1");
ok("BoA amount", p1?.amount, 24);
ok("BoA sender", p1?.sender_name, "Qudratealahy Ratul");
ok("BoA memo", p1?.memo_raw, "R-W7RU");
okTrue("BoA confirmation falls back to message id", !!p1?.confirmation);
const wf = "Wells Fargo\n\nRahim Uddin sent you $40.00 with Zelle\nMemo: R-4K7M\nConfirmation number: WF123456";
const p2 = Z.parseZelleEmail(wf, "You received money with Zelle", "msg2");
ok("WF amount", p2?.amount, 40);
ok("WF memo", p2?.memo_raw, "R-4K7M");
ok("WF confirmation", p2?.confirmation, "WF123456");
ok("outgoing payment refused", Z.parseZelleEmail("Your Zelle payment of $60.00 to AMINUN has been sent", "Zelle payment sent", "m3"), null);
ok("payment request refused", Z.parseZelleEmail("Someone requested $30 from you with Zelle", "Request", "m4"), null);
ok("our own code email refused", Z.parseZelleEmail("Your code: R-4K7M\nPut R-4K7M in the Zelle memo", "BPAU - your code", "m5"), null);
ok("non-zelle refused", Z.parseZelleEmail("Your statement is ready", "Statement", "m6"), null);

console.log("== DATES, UTAH ==");
ok("11am Utah -> 17:00 UTC", D.eventZoneInputToIso("2026-10-03T11:00"), "2026-10-03T17:00:00.000Z");
ok("round trip back to 11:00", D.isoToEventZoneInput("2026-10-03T17:00:00.000Z"), "2026-10-03T11:00");
ok("noon Utah -> 18:00 UTC", D.eventZoneInputToIso("2026-10-03T12:00"), "2026-10-03T18:00:00.000Z");
ok("winter, standard time -> 19:00 UTC", D.eventZoneInputToIso("2026-01-15T12:00"), "2026-01-15T19:00:00.000Z");
ok("garbage in, empty out", D.eventZoneInputToIso("nonsense"), "");
okTrue("closes at end of the day in Utah", D.closesAt("2026-09-26").toISOString().startsWith("2026-09-27T05:59:59"));
ok("date only formats", D.formatDateOnly("2026-10-03"), "Oct 3, 2026");

console.log("== ADDRESS ==");
const venue = { venue: "South Fork Park, Pavilion 1", address: "4988 S Fork Rd, Provo, UT 84604", city: "Provo, UT" };
ok("place line", A.placeLine(venue), "South Fork Park, Pavilion 1, Provo, UT");
ok("full address", A.fullAddress(venue), "South Fork Park, Pavilion 1, 4988 S Fork Rd, Provo, UT 84604");
okTrue("maps url built", A.mapsUrl(venue).startsWith("https://www.google.com/maps/search/"));
ok("postcode in venue suppresses city", A.placeLine({ venue: "4988 S Fork Rd, Provo, UT 84604", city: "Salt Lake City, UT" }), "4988 S Fork Rd, Provo, UT 84604");
ok("no city, no comma", A.placeLine({ venue: "Some Hall", city: "" }), "Some Hall");
okTrue("saved map link wins", A.mapsUrl({ ...venue, mapUrl: "https://maps.app.goo.gl/x" }) === "https://maps.app.goo.gl/x");

console.log(`\n${"=".repeat(60)}`);
if (results.length) console.log(results.join("\n"));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
