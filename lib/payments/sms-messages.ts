import "server-only";
import { formatDateOnly } from "./dates";
import { headcount, money, outstanding } from "./pricing";
import type { Settings } from "./settings";
import { ticketLinks } from "./ticket";
import type { RegistrationRow } from "./types";

/**
 * The two texts members receive, mirroring the two emails. Kept short on
 * purpose: every 160 characters costs another segment, and a wall of text on
 * a phone is read by nobody.
 */

/** A short name for the event, so the text does not spend its length on it. */
function shortEvent(s: Settings): string {
  return s.event_name.replace(/^\d{4}\s+/, "").trim() || "the event";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Sent right after registering: the code and where to send the money.
 * Worded to stay inside one 160 character segment for a typical name, which
 * halves what every registration costs to text.
 */
export function pendingSms(row: RegistrationRow, s: Settings): string {
  const owed = outstanding(row);
  // Venmo rides on the same sentence when it is offered. The text is
  // already two segments, and this keeps it there.
  const orVenmo = s.venmo_handle ? ` or Venmo @${s.venmo_handle}` : "";
  // Added to a code that was already paid once: they owe the difference and
  // keep the code, the link and the QR they already have.
  if ((row.amount_received ?? 0) > 0) {
    return [
      `BAU: ${firstName(row.name)}, added to your code ${row.code}.`,
      `Send Zelle ${money(owed)} to ${s.zelle_recipient}${orVenmo}, memo ${row.code}.`,
      "Your existing ticket still works. Reply STOP to opt out.",
    ].join(" ");
  }
  // Four numbered steps in the order they happen, the code twice: once as
  // the thing to copy, once as the memo. The memo is where people slip, so
  // it is its own step and the last thing they read.
  return [
    `BAU: ${firstName(row.name)}, your ${shortEvent(s)} code is ${row.code}.`,
    `1) Copy the code 2) Open Zelle${orVenmo} 3) Send ${money(owed)} to ${s.zelle_recipient} 4) Paste ${row.code} in the memo.`,
    `${headcount(row) > 0 ? "Ticket" : "Receipt"} follows once confirmed. Reply STOP to opt out.`,
  ].join(" ");
}

/** Sent when the payment is confirmed: the link to the ticket and its QR. */
export function receiptSms(row: RegistrationRow, s: Settings): string {
  const links = ticketLinks(row.code);
  const when = formatDateOnly(s.event_date);
  // No seats means no ticket: coupons are collected at the desk against the
  // code, and a donation needs nothing further at all.
  if (headcount(row) === 0) {
    const what =
      row.coupons_qty > 0
        ? `${row.coupons_qty} raffle coupon${row.coupons_qty === 1 ? "" : "s"} received. Collect at the coupon desk with code ${row.code} or your phone number.`
        : "Donation received, thank you. Nothing further to do.";
    return `BAU: ${what} This is a receipt, not a ticket.`;
  }
  const tail = links
    ? ` Your ticket: ${links.ticket}`
    : ` Your ticket number is ${row.code}.`;
  return `BAU: Payment confirmed for ${shortEvent(s)} on ${when}.${tail}`;
}
