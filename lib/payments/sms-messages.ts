import "server-only";
import { formatDateOnly } from "./dates";
import { money } from "./pricing";
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

/** Sent right after registering: the code and where to send the money. */
export function pendingSms(row: RegistrationRow, s: Settings): string {
  return [
    `BAU: ${firstName(row.name)}, your code for ${shortEvent(s)} is ${row.code}.`,
    `Zelle ${money(row.amount_due)} to ${s.zelle_recipient} and put ${row.code} in the memo.`,
    "Your ticket follows once we confirm. Reply STOP to opt out.",
  ].join(" ");
}

/** Sent when the payment is confirmed: the link to the ticket and its QR. */
export function receiptSms(row: RegistrationRow, s: Settings): string {
  const links = ticketLinks(row.code);
  const when = formatDateOnly(s.event_date);
  const tail = links
    ? ` Your ticket: ${links.ticket}`
    : ` Your ticket number is ${row.code}.`;
  return `BAU: Payment confirmed for ${shortEvent(s)} on ${when}.${tail}`;
}
