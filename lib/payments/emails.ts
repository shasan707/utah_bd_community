import "server-only";
import { formatDateOnly, formatInEventZone } from "./dates";
import { breakdownLines, money } from "./pricing";
import type { Settings } from "./settings";
import type { RegistrationRow } from "./types";

/**
 * Plain-text email bodies, the same wording members received from the old
 * system so nothing changes for them.
 */

export type EmailContent = { subject: string; text: string };

function questionsLine(s: Settings): string {
  return s.contact_email
    ? `Questions? Reply to this email or write to ${s.contact_email}.`
    : "Questions? Reply to this email.";
}

/** Sent right after registering: the code, the amount, and where to Zelle. */
export function pendingEmail(row: RegistrationRow, s: Settings): EmailContent {
  const amount = money(row.amount_due);
  const lines = breakdownLines(row, s).map((l) => `  ${l}`);
  const text = [
    `Assalamu alaikum ${row.name},`,
    "",
    `Your registration for ${s.event_name} is saved.`,
    "",
    `Your code:  ${row.code}`,
    `Amount:     ${amount}`,
    "",
    ...lines,
    "",
    `Send ${amount} via Zelle to:`,
    `  ${s.zelle_recipient}`,
    `  (${s.zelle_recipient_name})`,
    "",
    `IMPORTANT: put ${row.code} in the Zelle memo/note field.`,
    "",
    "You will get a receipt by email once we confirm the payment.",
    questionsLine(s),
    "",
    "BPAU",
  ].join("\n");
  return { subject: `BPAU - your code ${row.code} (${amount})`, text };
}

/** Sent when the treasurer confirms the payment. */
export function receiptEmail(row: RegistrationRow, s: Settings): EmailContent {
  const paid = row.amount_received ?? row.amount_due;
  const lines = breakdownLines(row, s).map((l) => `  ${l}`);
  const text = [
    "BPAU - Payment confirmed",
    "",
    `Receipt:  ${row.code}`,
    `Date:     ${formatInEventZone(new Date())}`,
    `Name:     ${row.name}`,
    `Paid:     ${money(paid)} via ${row.payment_method || "zelle"}`,
    "",
    ...lines,
    `  Total = ${money(row.amount_due)}`,
    "",
    `Event:  ${s.event_name}`,
    `Date:   ${formatDateOnly(s.event_date)}`,
    "",
    "Bring this email or your name to the check-in desk.",
    "",
    "BPAU",
  ].join("\n");
  return { subject: `BPAU - Payment confirmed (${row.code})`, text };
}
