// Venmo as the second way to pay: the notification parser, the links, and
// what members are told with it off and with it on. Reads nothing.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const B = "@/lib/payments";
const P = await import(`${B}/pricing.ts`);
const Z = await import(`${B}/zelle-parse.ts`);
const V = await import(`${B}/venmo-parse.ts`);
const { pendingEmail, receiptEmail } = await import(`${B}/emails.ts`);
const { pendingSms } = await import(`${B}/sms-messages.ts`);

let pass = 0, fail = 0;
const t = (n: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${n.padEnd(54)} ${okk ? "" : JSON.stringify(got) + "  want " + JSON.stringify(want)}`);
};

console.log("== THE NOTIFICATION EMAIL ==");
// Written to the shape Venmo has used for years. The rehearsal replaces this
// with a real captured notification, and that is the fixture that matters;
// until then this proves the parser does what the spec says it does.
const venmoMail = [
  "Rahim Uddin paid You $20.00",
  "R-4K7M",
  "Transfer Date and Amount:",
  "Sep 19, 2026 PDT · + $20.00",
  "Payment ID: 4123456789012345678",
  "See transaction: https://venmo.com/story/4123456789012345678",
  "Venmo is a service of PayPal, Inc.",
].join("\n");
const v1 = V.parseVenmoEmail(venmoMail, "Rahim Uddin paid you $20.00", "vm1");
t("amount", v1?.amount, 20);
t("sender", v1?.sender_name, "Rahim Uddin");
t("the note is the memo", v1?.memo_raw, "R-4K7M");
t("the payment id is the confirmation", v1?.confirmation, "4123456789012345678");

const v2 = V.parseVenmoEmail(
  "Sakib Hasan paid you $15.00\nfor the picnic r7x3m thanks\nhttps://venmo.com/x",
  "Sakib Hasan paid you $15.00",
  "vm2"
);
t("a note with words around the code is kept whole", v2?.memo_raw, "for the picnic r7x3m thanks");
t("and the code is still found in it", Z.extractCandidates(v2?.memo_raw ?? "").has("R7X3M"), true);

const v3 = V.parseVenmoEmail(
  "Anis Khan paid you $12.00\nhttps://venmo.com/story/1\nno id here",
  "Anis Khan paid you $12.00",
  "vm3"
);
t("no id: the email id keeps the payment unique", v3?.confirmation, "msg-vm3");
t("link line is not taken as the note", v3?.memo_raw, "no id here");

console.log("\n== WHAT IT MUST REFUSE ==");
t("money going out", V.parseVenmoEmail("You paid Rahim Uddin $20.00\nhttps://venmo.com", "You paid Rahim Uddin $20.00", "vm4"), null);
t("a request", V.parseVenmoEmail("Rahim Uddin requests $20.00\nhttps://venmo.com", "Rahim Uddin requests $20.00", "vm5"), null);
t("a charge", V.parseVenmoEmail("Rahim Uddin charged you $20.00\nhttps://venmo.com", "Rahim Uddin charged you $20.00", "vm6"), null);
t("a zelle email", V.parseVenmoEmail("Qudratealahy Ratul sent you $24.00\nBank of America", "Qudratealahy Ratul sent you $24.00", "vm7"), null);
t("our own code email", V.parseVenmoEmail("Your code: R-4K7M. Pay by Venmo. Put R-4K7M in the note", "BPAU - your code", "vm8"), null);
t("something with no venmo in it at all", V.parseVenmoEmail("Rahim Uddin paid you $20.00\nthanks", "Rahim Uddin paid you $20.00", "vm9"), null);

console.log("\n== THE TWO PARSERS STAY OUT OF EACH OTHER'S WAY ==");
t("the zelle parser ignores a venmo email", Z.parseZelleEmail(venmoMail, "Rahim Uddin paid you $20.00", "vm10"), null);
const boa = "Bank of America\nQudratealahy Ratul sent you $24.00\nR-4K7M\nConfirmation: BAC123456";
t("the zelle parser still reads a bank email", Z.parseZelleEmail(boa, "Qudratealahy Ratul sent you $24.00", "vm11")?.amount, 24);
t("the venmo parser leaves that bank email alone", V.parseVenmoEmail(boa, "Qudratealahy Ratul sent you $24.00", "vm12"), null);

console.log("\n== THE LINKS ==");
const links = P.venmoLinks("evue007", 20, "R-4K7M");
t("pay link carries handle, amount and note", links?.pay, "https://account.venmo.com/pay?txn=pay&recipients=evue007&amount=20.00&note=R-4K7M");
t("profile link", links?.profile, "https://venmo.com/u/evue007");
t("cents kept", P.venmoLinks("evue007", 15.5, "C-8K2P")?.pay.includes("amount=15.50"), true);
t("blank handle, no links", P.venmoLinks("", 20, "R-4K7M"), null);
t("blank handle with spaces, no links", P.venmoLinks("   ", 20, "R-4K7M"), null);

console.log("\n== WHAT MEMBERS ARE TOLD ==");
const s = {
  event_name: "2026 SLC BD Picnic", event_date: "2026-10-03", event_time: "11:00 AM",
  event_venue: "South Fork Park, Pavilion 1, 4988 S Fork Rd, Provo, UT 84604",
  registration_closes: "2026-09-26", registration_open: true,
  price_adult: 20, price_youth: 12, price_child: 0,
  coupon_single: 2, coupon_bundle_qty: 10, coupon_bundle_price: 15,
  zelle_recipient: "bpau.pay@gmail.com", zelle_recipient_name: "Md Shamim Ahmmed",
  venmo_handle: "", venmo_name: "",
  contact_email: "bpau.pay@gmail.com", pending_expiry_hours: 72, auto_confirm: true, sms_enabled: true,
};
const row = {
  code: "R-4K7M", name: "Rahim Uddin", created_at: "2026-09-17T10:00:00Z", phone: "5551234567", email: "a@b.com",
  adults: 2, youth: 1, children: 3, ticket_type: "professional", coupons_qty: 0, donation: 0, comment: "",
  amount_due: 52, status: "PENDING", payment_method: null, amount_received: null, paid_at: null,
  zelle_confirmation_id: null, zelle_sender_name: null, receipt_sent_at: null, pending_email_sent_at: null,
  email_error: null, created_by: "web", announcements_opt_in: false, notes: "", client_ip: null,
  checked_in_at: null, checked_in_by: "", coupons_collected_at: null, coupons_collected_by: "",
  code_sms_at: null, ticket_sms_at: null, sms_error: null, is_test: false,
};
const seg = (m: string) => (m.length <= 160 ? 1 : Math.ceil(m.length / 153));

console.log("  -- venmo off --");
const offMail = pendingEmail(row, s);
t("email never mentions venmo", /venmo/i.test(offMail.text + offMail.html), false);
t("text never mentions venmo", /venmo/i.test(pendingSms(row, s)), false);

console.log("  -- venmo on --");
const sv = { ...s, venmo_handle: "evue007", venmo_name: "Shamim Ahmmed" };
const onMail = pendingEmail(row, sv);
t("email text offers venmo with the name", /Or via Venmo to @evue007 \(Shamim Ahmmed\)/.test(onMail.text), true);
t("email leads with zelle", onMail.text.indexOf("via Zelle") < onMail.text.indexOf("via Venmo"), true);
t("email carries the prefilled pay link", onMail.text.includes("https://account.venmo.com/pay?txn=pay&recipients=evue007&amount=52.00&note=R-4K7M"), true);
t("email html has the venmo button", /Open Venmo with the amount and note filled in/.test(onMail.html), true);
t("email html has the profile fallback", /venmo\.com\/u\/evue007/.test(onMail.html), true);
t("email says the code goes in the note", /put R-4K7M in the memo or note/i.test(onMail.text), true);
const onSms = pendingSms(row, sv);
t("text offers venmo", /or Venmo @evue007/.test(onSms), true);
t("text names zelle first", onSms.indexOf("Zelle") < onSms.indexOf("Venmo"), true);
t("text stays at two segments", seg(onSms), 2);
t("text under 306 chars, the two-segment ceiling", onSms.length <= 306, true);
console.log(`     with venmo    ${String(onSms.length).padStart(3)} chars, ${seg(onSms)} segment(s)`);
const topped = { ...row, coupons_qty: 10, amount_due: 35, amount_received: 20, status: "PAID" };
const onTop = pendingSms(topped, sv);
t("top-up text offers venmo too", /or Venmo @evue007/.test(onTop), true);
t("top-up text stays at two segments", seg(onTop) <= 2, true);
const paidRow = { ...row, status: "PAID", payment_method: "venmo", amount_received: 52, paid_at: "2026-09-19T10:00:00Z" };
const rcpt = receiptEmail(paidRow, sv);
t("receipt for a venmo payment has no undefined", /undefined/.test(rcpt.text + rcpt.html), false);
t("receipt still a ticket", /your ticket for/.test(rcpt.subject), true);

console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
