// Message templates across every buyer shape, plus what each text costs.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const B = "@/lib/payments";
const { receiptEmail, pendingEmail } = await import(`${B}/emails.ts`);
const { receiptSms, pendingSms } = await import(`${B}/sms-messages.ts`);

let pass = 0, fail = 0;
const t = (n: string, got: unknown, want: unknown) => {
  const okk = JSON.stringify(got) === JSON.stringify(want);
  okk ? pass++ : fail++;
  console.log(`  ${okk ? "ok  " : "FAIL"} ${n.padEnd(52)} ${okk ? "" : JSON.stringify(got) + "  want " + JSON.stringify(want)}`);
};

const s = {
  event_name: "2026 SLC BD Picnic", event_date: "2026-10-03", event_time: "11:00 AM",
  event_venue: "South Fork Park, Pavilion 1, 4988 S Fork Rd, Provo, UT 84604",
  registration_closes: "2026-09-26", price_adult: 20, price_youth: 12, price_child: 0,
  coupon_single: 2, coupon_bundle_qty: 10, coupon_bundle_price: 15,
  zelle_recipient: "bpau.pay@gmail.com", zelle_recipient_name: "Md Shamim Ahmmed",
  contact_email: "bpau.pay@gmail.com",
};
const base = {
  created_at: "2026-09-17T10:00:00Z", phone: "5551234567", email: "a@b.com",
  ticket_type: "professional", comment: "", status: "PAID", payment_method: "zelle",
  paid_at: "2026-09-17T10:05:00Z", zelle_confirmation_id: "BACxyz", zelle_sender_name: "X",
  receipt_sent_at: null, pending_email_sent_at: null, email_error: null, created_by: "web",
  announcements_opt_in: false, notes: "", client_ip: null, checked_in_at: null,
  checked_in_by: "", coupons_collected_at: null, coupons_collected_by: "",
  code_sms_at: null, ticket_sms_at: null, sms_error: null,
  adults: 0, youth: 0, children: 0, coupons_qty: 0, donation: 0,
};
const row = (o: Record<string, unknown>) => ({ ...base, ...o });

const attending = row({ code: "R-4K7M", name: "Rahim Uddin", adults: 2, youth: 1, children: 3, amount_due: 52, amount_received: 52 });
const couponsOnly = row({ code: "C-8K2P", name: "Rahim Uddin", coupons_qty: 10, amount_due: 15, amount_received: 15 });
const donationOnly = row({ code: "D-3QW9", name: "Rahim Uddin", donation: 50, amount_due: 50, amount_received: 50 });
const bothNoSeats = row({ code: "C-6RT1", name: "Rahim Uddin", coupons_qty: 10, donation: 50, amount_due: 65, amount_received: 65 });
const ticketPlusExtras = row({ code: "R-9ZZ1", name: "Rahim Uddin", adults: 1, coupons_qty: 5, donation: 50, amount_due: 80, amount_received: 80 });
const longName = row({ code: "R-LONG", name: "Mohammad Abdur Rahman Chowdhury Al-Mahmud", adults: 2, amount_due: 40, amount_received: 40 });

console.log("== RECEIPT: attending gets a ticket ==");
let e = receiptEmail(attending, s);
t("subject says ticket", /your ticket for/.test(e.subject), true);
t("body reserves seats", /seats for .* are reserved/.test(e.text), true);
t("lists all three bands", /2 adults @ \$20\.00/.test(e.text) && /1 youth \(10 to 16\) @ \$12\.00/.test(e.text) && /3 children under 10 = free/.test(e.text), true);
t("total correct", /Total = \$52\.00/.test(e.text), true);
t("admits line", /2 adults, 1 youth, 3 children/.test(e.text) || e.html.includes("2 adults, 1 youth, 3 children"), true);

console.log("\n== RECEIPT: coupons only is a receipt, not a ticket ==");
e = receiptEmail(couponsOnly, s);
t("subject says receipt", /your receipt for/.test(e.subject), true);
t("never says ticket in the subject", /ticket/i.test(e.subject), false);
t("no seats claim", /seats .* are reserved/.test(e.text), false);
t("says not an admission ticket", /not an admission ticket/i.test(e.text), true);
t("points at the coupon desk", /coupon desk/i.test(e.text), true);
t("receipt number, not ticket number", /Receipt number:/.test(e.text), true);
t("html header says Receipt", /Receipt/.test(e.html) && !/Admission ticket/.test(e.html), true);
t("still shows the money", /10 raffle draw coupons \(1 bundle of 10\) = \$15\.00/.test(e.text), true);

console.log("\n== RECEIPT: donation only ==");
e = receiptEmail(donationOnly, s);
t("subject says receipt", /your receipt for/.test(e.subject), true);
t("thanks for the donation", /donation is received/i.test(e.text), true);
t("nothing further to do", /nothing further to do/i.test(e.text), true);
t("no coupon desk mention", /coupon desk/i.test(e.text), false);

console.log("\n== RECEIPT: coupons and donation, still no seats ==");
e = receiptEmail(bothNoSeats, s);
t("treated as a receipt", /your receipt for/.test(e.subject), true);
t("mentions the coupons", /10 raffle draw coupons are in the draw/.test(e.text), true);
t("both lines in the money", /coupons \(1 bundle of 10\) = \$15\.00/.test(e.text) && /Donation = \$50\.00/.test(e.text), true);
t("total is the sum", /Total = \$65\.00/.test(e.text), true);

console.log("\n== RECEIPT: a ticket that also has coupons and a donation ==");
e = receiptEmail(ticketPlusExtras, s);
t("still a ticket", /your ticket for/.test(e.subject), true);
t("seats reserved", /are reserved/.test(e.text), true);
t("coupons listed", /5 raffle draw coupons/.test(e.text), true);
t("donation listed", /Donation = \$50\.00/.test(e.text), true);

console.log("\n== PENDING (code) EMAIL ==");
const pe = pendingEmail(couponsOnly, s);
t("carries the code", pe.text.includes("C-8K2P"), true);
t("says the amount", /\$15\.00/.test(pe.text), true);
t("names the zelle address", pe.text.includes("bpau.pay@gmail.com"), true);
t("tells them to use the memo", /memo/i.test(pe.text), true);

console.log("\n== TEXT MESSAGES, AND WHAT THEY COST ==");
const seg = (m: string) => (m.length <= 160 ? 1 : Math.ceil(m.length / 153));
for (const [label, r] of [["attending", attending], ["coupons only", couponsOnly], ["donation only", donationOnly], ["long name", longName]] as const) {
  const a = pendingSms(r, s), b = receiptSms(r, s);
  console.log(`  ${label}`);
  console.log(`     code text     ${String(a.length).padStart(3)} chars, ${seg(a)} segment(s)`);
  console.log(`     confirm text  ${String(b.length).padStart(3)} chars, ${seg(b)} segment(s)`);
}
t("coupon confirm says receipt not ticket", /receipt, not a ticket/i.test(receiptSms(couponsOnly, s)), true);
t("coupon confirm names the desk", /coupon desk/i.test(receiptSms(couponsOnly, s)), true);
t("donation confirm thanks them", /donation received/i.test(receiptSms(donationOnly, s)), true);
t("attending confirm mentions a ticket", /ticket/i.test(receiptSms(attending, s)), true);
// A pending message belongs to a row with nothing paid on it yet.
const unpaidCoupons = row({ code: "C-8K2P", name: "Rahim Uddin", coupons_qty: 10, amount_due: 15, amount_received: null, status: "PENDING" });
const unpaidAttending = row({ code: "R-4K7M", name: "Rahim Uddin", adults: 2, amount_due: 40, amount_received: null, status: "PENDING" });
t("code text promises a receipt, not a ticket, for coupons", /Receipt follows/.test(pendingSms(unpaidCoupons, s)), true);
t("code text promises a ticket for attendees", /Ticket follows/.test(pendingSms(unpaidAttending, s)), true);
t("unpaid code text asks for the whole amount", /\$40\.00/.test(pendingSms(unpaidAttending, s)), true);

console.log("\n== TOP-UP MESSAGES: the balance, and the code they keep ==");
// Paid $20, then 10 coupons added: owes $15 on the same code.
const toppedUp = row({ code: "R-4K7M", name: "Rahim Uddin", adults: 1, coupons_qty: 10, amount_due: 35, amount_received: 20, status: "PAID" });
const tSms = pendingSms(toppedUp, s);
t("text asks for the balance only", /\$15\.00/.test(tSms), true);
t("text does not ask for the total", /\$35\.00/.test(tSms), false);
t("text says it was added to their code", /added to your code/i.test(tSms), true);
t("text reassures about the old ticket", /existing ticket still works/i.test(tSms), true);
t("text keeps the same code", tSms.includes("R-4K7M"), true);
const tMail = pendingEmail(toppedUp, s);
t("email asks for the balance", /Still to pay: \$15\.00/.test(tMail.text), true);
t("email shows the full total too", /Total = \$35\.00/.test(tMail.text), true);
t("email shows what was already paid", /Already paid = \$20\.00/.test(tMail.text), true);
t("email says the code does not change", /code does not change/i.test(tMail.text), true);
t("every text offers STOP", pendingSms(attending, s).includes("Reply STOP"), true);

console.log("\n== NO PLACEHOLDER OR BROKEN TEXT ANYWHERE ==");
const all = [receiptEmail(attending, s), receiptEmail(couponsOnly, s), receiptEmail(donationOnly, s), pendingEmail(attending, s)];
t("no undefined", all.some((x) => /undefined/.test(x.text + x.html + x.subject)), false);
t("no NaN", all.some((x) => /NaN/.test(x.text + x.html + x.subject)), false);
t("no unreplaced braces", all.some((x) => /\$\{/.test(x.text + x.html)), false);
t("no lorem", all.some((x) => /lorem|placeholder|TODO/i.test(x.text)), false);

console.log(`\n${"=".repeat(60)}\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
