import "server-only";
import { formatDateOnly, formatInEventZone } from "./dates";
import { breakdownLines, money } from "./pricing";
import type { Settings } from "./settings";
import type { RegistrationRow } from "./types";

/**
 * The two emails members receive. Each has a plain-text version (what the
 * first system sent, kept as the fallback) and an HTML version: the code
 * email as a payment card, the receipt as an admission ticket with a
 * greeting and the event details.
 */

export type EmailContent = { subject: string; text: string; html: string };

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://uthahbdcommunity.vercel.app"
).replace(/\/+$/, "");

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
  const lines = [`Event:  ${s.event_name}`, `Date:   ${formatDateOnly(s.event_date)}`];
  if (s.event_time) lines.push(`Time:   ${s.event_time}`);
  if (s.event_venue) lines.push(`Venue:  ${s.event_venue}`);
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
Utha USA, the Bangladeshi community of Salt Lake City. A community initiative of Bangladesh Association Utah (BPAU).
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
  const amount = money(row.amount_due);
  const lines = breakdownLines(row, s);
  const track = trackLink(row.code);

  const text = [
    `Assalamu alaikum ${row.name},`,
    "",
    `Your registration for ${s.event_name} is saved.`,
    "",
    `Your code:  ${row.code}`,
    `Amount:     ${amount}`,
    "",
    ...lines.map((l) => `  ${l}`),
    "",
    `Send ${amount} via Zelle to:`,
    `  ${s.zelle_recipient}`,
    `  (${s.zelle_recipient_name})`,
    "",
    `IMPORTANT: put ${row.code} in the Zelle memo/note field.`,
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
Your registration is saved. One more step: send the Zelle below and your ticket follows by email.
</td></tr>`,
    `<tr><td style="padding:8px 32px 20px;">${codeBlock("Your payment code", row.code, amount)}</td></tr>`,
    `<tr><td style="padding:0 32px 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">Now send the Zelle</td></tr>`,
    `<tr><td style="padding:0 32px 16px;">${stepList([
      "Open your bank app and choose Zelle.",
      `Send <strong>${esc(amount)}</strong> to <strong>${esc(s.zelle_recipient)}</strong>${
        s.zelle_recipient_name ? ` <span style="color:${COLORS.muted};">(${esc(s.zelle_recipient_name)})</span>` : ""
      }.`,
      `Type <strong style="color:${COLORS.red};">${esc(row.code)}</strong> in the memo or note field. This is how we match the payment to you.`,
    ])}</td></tr>`,
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
  const people = row.adults + row.children;

  const text = [
    `Assalamu alaikum ${row.name},`,
    "",
    `Thank you. Your payment is confirmed and your seats for ${s.event_name} are reserved.`,
    "This email is your ticket. Show it, or just give your name, at the check-in desk.",
    "",
    `Ticket number: ${row.code}`,
    `Name:          ${row.name}`,
    `Paid:          ${money(paid)} via ${method} on ${paidOn}`,
    "",
    ...lines.map((l) => `  ${l}`),
    `  Total = ${money(row.amount_due)}`,
    "",
    ...eventLines(s),
    "",
    "We look forward to seeing you there.",
    `Track your registration: ${track}`,
    questionsLine(s),
    "",
    "BPAU",
  ].join("\n");

  const ticketPairs: [string, string][] = [
    ["Ticket holder", row.name],
    [
      "Admits",
      people > 0
        ? `${row.adults} adult${row.adults === 1 ? "" : "s"}${
            row.children ? `, ${row.children} child${row.children === 1 ? "" : "ren"}` : ""
          }`
        : "No seats (coupons or donation only)",
    ],
    ...(row.coupons_qty > 0 ? [["Food coupons", String(row.coupons_qty)] as [string, string]] : []),
    ["Paid", `${money(paid)} via ${method}, ${paidOn}`],
  ];

  const inner = [
    header("Admission ticket", s.event_name, [
      `${esc(formatDateOnly(s.event_date))}${s.event_time ? `, ${esc(s.event_time)}` : ""}`,
      s.event_venue ? esc(s.event_venue) : "",
    ]),
    `<tr><td style="padding:28px 32px 8px;font-size:16px;line-height:1.6;">
Assalamu alaikum ${esc(firstName(row.name))},<br><br>
Thank you. Your payment is confirmed and your seats are reserved. This email is your ticket:
show it at the check-in desk, or simply give your name. We look forward to celebrating with you.
</td></tr>`,
    `<tr><td style="padding:8px 32px 20px;">${codeBlock("Ticket number", row.code, `Paid ${money(paid)}`)}</td></tr>`,
    `<tr><td style="padding:0 32px 8px;">${rows(ticketPairs)}</td></tr>`,
    `<tr><td style="padding:12px 32px 0;"><div style="border-top:2px dashed ${COLORS.sand};"></div></td></tr>`,
    `<tr><td style="padding:16px 32px 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">Event details</td></tr>`,
    `<tr><td style="padding:0 32px 16px;">${rows(eventPairs(s))}</td></tr>`,
    `<tr><td style="padding:0 32px 20px;"><div style="background:${COLORS.cream};border-radius:14px;padding:14px 18px;">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.forest};font-weight:700;">Receipt</div>
<div style="margin-top:6px;font-size:14px;line-height:1.7;color:${COLORS.ink};">${lines.map(esc).join("<br>")}<br><strong>Total ${esc(money(row.amount_due))}</strong></div>
</div></td></tr>`,
    `<tr><td style="padding:0 32px 26px;font-size:14px;line-height:1.6;color:${COLORS.muted};">
Keep this email. You can also <a href="${esc(track)}" style="color:${COLORS.forest};font-weight:600;">view your ticket online</a>.
</td></tr>`,
  ].join("\n");

  return {
    subject: `BPAU - your ticket for ${s.event_name} (${row.code})`,
    text,
    html: shell(`Ticket ${row.code}`, inner, s),
  };
}
