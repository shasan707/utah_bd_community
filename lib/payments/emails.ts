import "server-only";
import { SITE_URL } from "@/lib/site-url";
import { formatDateOnly, formatInEventZone } from "./dates";
import {
  breakdownLines,
  headcount,
  money,
  outstanding,
  partySummary,
  venmoLinks,
} from "./pricing";
import type { Settings } from "./settings";
import { ticketLinks } from "./ticket";
import type { RegistrationRow } from "./types";

/**
 * The two emails members receive. Each has a plain-text version (what the
 * first system sent, kept as the fallback) and an HTML version: the code
 * email as a payment card, the receipt as an admission ticket with the QR
 * code scanned at the door, a greeting, and the event details.
 */

export type EmailContent = { subject: string; text: string; html: string };

const COLORS = {
  forest: "#0d4f42",
  forestDeep: "#123f38",
  mint: "#b8cbc4",
  ivory: "#fafaf8",
  cream: "#f4f1ea",
  sand: "#dfd8cb",
  ink: "#1d1d1f",
  muted: "#676d68",
  red: "#e4574f",
};

function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function trackLink(code: string): string {
  return `${SITE_URL}/register/status?code=${encodeURIComponent(code)}`;
}

function questionsLine(s: Settings): string {
  return s.contact_email
    ? `Questions? Reply to this email or write to ${s.contact_email}.`
    : "Questions? Reply to this email.";
}

/** Event lines shared by both emails. */
function eventLines(s: Settings): string[] {
  // Name, date, time and place come from the event itself (see getSettings),
  // the same values the event page shows, plus the map and the page link.
  const lines = [`Event:  ${s.event_name}`, `Date:   ${formatDateOnly(s.event_date)}`];
  if (s.event_time) lines.push(`Time:   ${s.event_time}`);
  if (s.event_venue) lines.push(`Venue:  ${s.event_venue}`);
  if (s.event_map_url) lines.push(`Map:    ${s.event_map_url}`);
  if (s.event_url) lines.push(`Details: ${s.event_url}`);
  return lines;
}

/* ------------------------------------------------------------------ */
/* HTML building blocks                                                */
/* ------------------------------------------------------------------ */

function shell(title: string, inner: string, s: Settings): string {
  const contact = s.contact_email
    ? `Questions? Reply to this email or write to <a href="mailto:${esc(s.contact_email)}" style="color:${COLORS.forest};">${esc(s.contact_email)}</a>.`
    : "Questions? Reply to this email.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${COLORS.sand};">
${inner}
<tr><td style="padding:20px 32px 28px;font-size:13px;line-height:1.6;color:${COLORS.muted};border-top:1px solid ${COLORS.sand};">
${contact}<br>
Bangladeshi Association of Utah (BAU), the Bangladeshi community of Salt Lake City.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function header(kicker: string, title: string, sub: string[]): string {
  const subHtml = sub
    .filter(Boolean)
    .map((l) => `<div style="margin-top:4px;font-size:14px;color:${COLORS.mint};">${l}</div>`)
    .join("");
  return `<tr><td style="background:${COLORS.forest};padding:28px 32px;color:${COLORS.ivory};">
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.mint};font-weight:700;">${esc(kicker)}</div>
<div style="margin-top:8px;font-size:26px;line-height:1.2;font-weight:800;">${esc(title)}</div>
${subHtml}
</td></tr>`;
}

function codeBlock(label: string, code: string, amount: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.forestDeep};border-radius:16px;">
<tr><td align="center" style="padding:22px 16px;color:${COLORS.ivory};">
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${COLORS.mint};font-weight:700;">${esc(label)}</div>
<div style="margin-top:8px;font-size:40px;letter-spacing:6px;font-weight:900;font-family:Consolas,'Courier New',monospace;">${esc(code)}</div>
<div style="margin-top:6px;font-size:20px;font-weight:700;color:${COLORS.mint};">${esc(amount)}</div>
</td></tr>
</table>`;
}

function rows(pairs: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
${pairs
  .map(
    ([k, v]) =>
      `<tr><td style="padding:6px 0;color:${COLORS.muted};width:38%;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;color:${COLORS.ink};font-weight:600;">${esc(v)}</td></tr>`
  )
  .join("")}
</table>`;
}

function stepList(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5;">
${items
  .map(
    (html, i) =>
      `<tr><td style="padding:8px 0;vertical-align:top;width:36px;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:13px;background:${COLORS.forest};color:${COLORS.ivory};text-align:center;font-weight:800;font-size:13px;">${i + 1}</span></td><td style="padding:8px 0;vertical-align:top;color:${COLORS.ink};">${html}</td></tr>`
  )
  .join("")}
</table>`;
}

function eventPairs(s: Settings): [string, string][] {
  const pairs: [string, string][] = [
    ["Event", s.event_name],
    ["Date", formatDateOnly(s.event_date)],
  ];
  if (s.event_time) pairs.push(["Time", s.event_time]);
  if (s.event_venue) pairs.push(["Venue", s.event_venue]);
  return pairs;
}

/* ------------------------------------------------------------------ */
/* The code email                                                      */
/* ------------------------------------------------------------------ */

/** Sent right after registering: the code, the amount, and where to Zelle. */
export function pendingEmail(row: RegistrationRow, s: Settings): EmailContent {
  // The balance, not the whole bill. Somebody adding coupons to a code they
  // have already paid once owes only the difference, and the breakdown below
  // shows everything on the code so the two together add up.
  const owed = outstanding(row);
  const amount = money(owed);
  const topUp = (row.amount_received ?? 0) > 0;
  const lines = breakdownLines(row, s);
  const track = trackLink(row.code);
  // Null when Venmo is not offered, and then nothing below mentions it.
  const venmo = venmoLinks(s.venmo_handle, owed, row.code);

  const text = [
    `Assalamu alaikum ${row.name},`,
    "",
    topUp
      ? `This is added to your existing registration for ${s.event_name}. Your code does not change, and the ticket already on your phone still works.`
      : `Your registration for ${s.event_name} is saved.`,
    "",
    `Your code:  ${row.code}`,
    `${topUp ? "Still to pay:" : "Amount:    "} ${amount}`,
    "",
    ...(topUp ? [`Everything on this code:`] : []),
    ...lines.map((l) => `  ${l}`),
    ...(topUp
      ? [
          `  Total = ${money(row.amount_due)}`,
          `  Already paid = ${money(row.amount_received ?? 0)}`,
        ]
      : []),
    "",
    "How to pay, step by step:",
    `  1. Copy your code:  ${row.code}`,
    `  2. Open Zelle${venmo ? " (or Venmo, link below)" : ""}.`,
    `  3. Send ${amount} to ${s.zelle_recipient}`,
    `     Zelle will show the name ${s.zelle_recipient_name}. That is us.`,
    `  4. Paste ${row.code} in the memo or note box.`,
    "     This is how we match your payment to you. Please do not skip it.",
    ...(venmo
      ? [
          "",
          `Venmo instead? Pay @${s.venmo_handle}${s.venmo_name ? ` (${s.venmo_name})` : ""}, same amount, ${row.code} in the note.`,
          `Fastest on a phone, amount and note already filled in:`,
          `  ${venmo.pay}`,
        ]
      : []),
    "",
    "You will get your ticket by email once we confirm the payment.",
    `Track your registration: ${track}`,
    questionsLine(s),
    "",
    "BPAU",
  ].join("\n");

  const inner = [
    header("Register and pay", s.event_name, [
      `${esc(formatDateOnly(s.event_date))}${s.event_time ? `, ${esc(s.event_time)}` : ""}`,
      s.event_venue ? esc(s.event_venue) : "",
    ]),
    `<tr><td style="padding:28px 32px 8px;font-size:16px;line-height:1.6;">
Assalamu alaikum ${esc(firstName(row.name))},<br><br>
Your registration is saved. One more step: send the payment below and your ticket follows by email.
</td></tr>`,
    `<tr><td style="padding:8px 32px 20px;">${codeBlock("Your payment code", row.code, amount)}</td></tr>`,
    `<tr><td style="padding:0 32px 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">How to pay, step by step</td></tr>`,
    `<tr><td style="padding:0 32px 16px;">${stepList([
      `Copy your code: <strong style="font-family:Consolas,Menlo,monospace;font-size:17px;letter-spacing:2px;color:${COLORS.red};">${esc(row.code)}</strong> <span style="color:${COLORS.muted};">(press and hold it to copy)</span>`,
      `Open your bank app and choose <strong style="color:#6D1ED4;">Zelle</strong>${
        venmo ? `, or use <strong style="color:#008CFF;">Venmo</strong> below` : ""
      }.`,
      `Send <strong>${esc(amount)}</strong> to <strong>${esc(s.zelle_recipient)}</strong>.${
        s.zelle_recipient_name
          ? `<br><span style="color:${COLORS.muted};">Zelle will show the name ${esc(s.zelle_recipient_name)}. That is us.</span>`
          : ""
      }`,
      `Paste <strong style="color:${COLORS.red};">${esc(row.code)}</strong> in the <strong>memo or note box</strong> before you send. This is how we match the payment to you. Please do not skip it.`,
    ])}</td></tr>`,
    ...(venmo
      ? [
          `<tr><td style="padding:4px 32px 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">Or send it with Venmo, fastest on a phone</td></tr>`,
          `<tr><td style="padding:0 32px 20px;font-size:15px;line-height:1.6;color:${COLORS.ink};">
Same amount, same code. Open <strong style="color:#008CFF;">Venmo</strong> and pay <strong>@${esc(s.venmo_handle)}</strong>${
            s.venmo_name ? ` <span style="color:${COLORS.muted};">(${esc(s.venmo_name)})</span>` : ""
          } and put <strong style="color:${COLORS.red};">${esc(row.code)}</strong> in the note.<br>
<a href="${esc(venmo.pay)}" style="display:inline-block;margin-top:10px;padding:10px 18px;border-radius:999px;background:#008CFF;color:#ffffff;font-weight:700;text-decoration:none;">Open Venmo with the amount and note filled in</a><br>
<span style="font-size:12px;color:${COLORS.muted};">If that does not open the app, go to <a href="${esc(venmo.profile)}" style="color:${COLORS.forest};">venmo.com/u/${esc(s.venmo_handle)}</a> and type them in.</span>
</td></tr>`,
        ]
      : []),
    `<tr><td style="padding:0 32px 20px;"><div style="background:${COLORS.cream};border-radius:14px;padding:14px 18px;">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">What you are paying for</div>
<div style="margin-top:6px;font-size:14px;line-height:1.7;color:${COLORS.ink};">${lines.map(esc).join("<br>")}</div>
</div></td></tr>`,
    `<tr><td style="padding:0 32px 26px;font-size:14px;line-height:1.6;color:${COLORS.muted};">
Once the payment is confirmed, your ticket arrives in this inbox. You can also
<a href="${esc(track)}" style="color:${COLORS.forest};font-weight:600;">track your registration</a> at any time.
</td></tr>`,
  ].join("\n");

  return {
    subject: `BPAU - your code ${row.code} (${amount})`,
    text,
    html: shell(`Your code ${row.code}`, inner, s),
  };
}

/* ------------------------------------------------------------------ */
/* The ticket                                                          */
/* ------------------------------------------------------------------ */

/** Sent when the payment is confirmed: greeting, event details, the ticket. */
export function receiptEmail(row: RegistrationRow, s: Settings): EmailContent {
  const paid = row.amount_received ?? row.amount_due;
  const lines = breakdownLines(row, s);
  const method = row.payment_method || "zelle";
  const paidOn = formatInEventZone(row.paid_at ? new Date(row.paid_at) : new Date());
  const track = trackLink(row.code);
  const links = ticketLinks(row.code);
  const ticketPage = links?.ticket ?? track;
  const people = headcount(row);
  // Someone who bought coupons or gave a donation without registering has no
  // seats, so this is a receipt rather than a ticket, and it says so. The QR
  // stays because coupons are collected at the desk against it.
  const seats = people > 0;
  const noSeatsIntro =
    row.coupons_qty > 0
      ? `Thank you. Your payment is confirmed and your ${row.coupons_qty} raffle draw coupon${row.coupons_qty === 1 ? " is" : "s are"} in the draw.`
      : "Thank you. Your donation is received, and it goes towards running the day.";
  const noSeatsHow =
    row.coupons_qty > 0
      ? "To collect your coupons at the picnic, show this code or give your phone number at the coupon desk. This is not an admission ticket."
      : "There is nothing further to do. This is a receipt, not an admission ticket.";

  const text = [
    `Assalamu alaikum ${row.name},`,
    "",
    ...(seats
      ? [
          `Thank you. Your payment is confirmed and your seats for ${s.event_name} are reserved.`,
          "This email is your ticket. Show the QR code, or just give your name, at the check-in desk.",
        ]
      : [noSeatsIntro, noSeatsHow]),
    "",
    `${seats ? "Ticket number" : "Receipt number"}: ${row.code}`,
    `Name:          ${row.name}`,
    `Paid:          ${money(paid)} via ${method} on ${paidOn}`,
    "",
    ...lines.map((l) => `  ${l}`),
    `  Total = ${money(row.amount_due)}`,
    "",
    ...eventLines(s),
    "",
    seats ? "We look forward to seeing you there." : "Thank you for supporting the association.",
    `${seats ? "Your ticket with the QR code" : "Your receipt"}: ${ticketPage}`,
    questionsLine(s),
    "",
    "BPAU",
  ].join("\n");

  const ticketPairs: [string, string][] = [
    [seats ? "Ticket holder" : "Name", row.name],
    ["Admits", seats ? partySummary(row) : "Nobody. Coupons or donation only, not a ticket"],
    ...(row.coupons_qty > 0
      ? [["Raffle draw coupons", String(row.coupons_qty)] as [string, string]]
      : []),
    ["Paid", `${money(paid)} via ${method}, ${paidOn}`],
  ];

  const inner = [
    header(seats ? "Admission ticket" : "Receipt", s.event_name, [
      `${esc(formatDateOnly(s.event_date))}${s.event_time ? `, ${esc(s.event_time)}` : ""}`,
      s.event_venue ? esc(s.event_venue) : "",
    ]),
    `<tr><td style="padding:28px 32px 8px;font-size:16px;line-height:1.6;">
Assalamu alaikum ${esc(firstName(row.name))},<br><br>
${
      seats
        ? "Thank you. Your payment is confirmed and your seats are reserved. This email is your ticket: show the QR code at the check-in desk, or simply give your name. We look forward to celebrating with you."
        : `${esc(noSeatsIntro)} ${esc(noSeatsHow)}`
    }
</td></tr>`,
    `<tr><td style="padding:8px 32px 12px;">${codeBlock(seats ? "Ticket number" : "Receipt number", row.code, `Paid ${money(paid)}`)}</td></tr>`,
    ...(links
      ? [
          `<tr><td align="center" style="padding:4px 32px 16px;">
<a href="${esc(links.ticket)}" style="text-decoration:none;"><img src="${esc(links.qr)}" width="200" height="200" alt="QR code for ticket ${esc(row.code)}" style="display:block;width:200px;height:200px;margin:0 auto;border:1px solid ${COLORS.sand};border-radius:12px;"></a>
<div style="margin-top:8px;font-size:13px;line-height:1.5;color:${COLORS.muted};">Scan this at the door. If the picture does not show, <a href="${esc(links.ticket)}" style="color:${COLORS.forest};font-weight:600;">open your ticket</a> on your phone.</div>
</td></tr>`,
        ]
      : []),
    `<tr><td style="padding:0 32px 8px;">${rows(ticketPairs)}</td></tr>`,
    `<tr><td style="padding:12px 32px 0;"><div style="border-top:2px dashed ${COLORS.sand};"></div></td></tr>`,
    `<tr><td style="padding:16px 32px 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">Event details</td></tr>`,
    `<tr><td style="padding:0 32px 16px;">${rows(eventPairs(s))}</td></tr>`,
    ...(s.event_map_url || s.event_url
      ? [
          `<tr><td style="padding:0 32px 20px;font-size:14px;line-height:1.6;">${[
            s.event_map_url
              ? `<a href="${esc(s.event_map_url)}" style="color:${COLORS.forest};font-weight:600;">Open in Maps</a>`
              : "",
            s.event_url
              ? `<a href="${esc(s.event_url)}" style="color:${COLORS.forest};font-weight:600;">Event details and the day's schedule</a>`
              : "",
          ]
            .filter(Boolean)
            .join(`<span style="color:${COLORS.muted};"> &middot; </span>`)}</td></tr>`,
        ]
      : []),
    `<tr><td style="padding:0 32px 20px;"><div style="background:${COLORS.cream};border-radius:14px;padding:14px 18px;">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">Receipt</div>
<div style="margin-top:6px;font-size:14px;line-height:1.7;color:${COLORS.ink};">${lines.map(esc).join("<br>")}<br><strong>Total ${esc(money(row.amount_due))}</strong></div>
</div></td></tr>`,
    `<tr><td style="padding:0 32px 26px;font-size:14px;line-height:1.6;color:${COLORS.muted};">
Keep this email. You can also <a href="${esc(ticketPage)}" style="color:${COLORS.forest};font-weight:600;">view your ticket online</a>.
</td></tr>`,
  ].join("\n");

  return {
    subject: seats
      ? `BPAU - your ticket for ${s.event_name} (${row.code})`
      : `BPAU - your receipt for ${s.event_name} (${row.code})`,
    text,
    html: shell(`${seats ? "Ticket" : "Receipt"} ${row.code}`, inner, s),
  };
}
