/**
 * Reads Venmo's "<name> paid you $<amount>" notification email.
 *
 * Kept apart from zelle-parse.ts on purpose. Every live confirmation so far
 * went through the Zelle parser, and Venmo's emails are shaped differently
 * enough that one function serving both would have to be loosened in ways
 * that could change what the Zelle side accepts. This file can be wrong
 * without the Zelle side noticing.
 *
 * Written to the shape Venmo has used for years: the subject and the first
 * line are "<name> paid you $<amount>" (older mails capitalise "You"), the
 * note the sender typed follows on its own line, and a transaction or
 * payment id appears lower down. The fixture in tests/suite-logic.mts is a
 * real notification captured during the rehearsal; if Venmo changes its
 * wording, that test is what goes red.
 *
 * Strict about one thing, like the Zelle parser: only money coming in.
 * Charges, requests and payments the account itself made are refused.
 *
 * Pure function with no server imports, so it can be unit tested alone.
 */

import type { ParsedZelle } from "./zelle-parse";

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_RE = new RegExp(`\\b([RCD])-?([${CODE_ALPHABET}]{4})\\b`, "gi");

/** "Rahim Uddin paid you $20.00", either capitalisation of "you". */
const PAID_YOU_RE =
  /([A-Z][A-Za-z.'-]+(?:[ \t]+[A-Z][A-Za-z.'-]+){0,4})[ \t]+paid[ \t]+you[ \t]+\$\s?([\d,]+\.\d{2})/i;

const NOT_INCOMING_RE =
  /you paid|you charged|charged you|requests? (?:\$|money|payment)|payment request|you requested|requested \$|you sent/i;

/** The site's own emails mention the code and the word Venmo; never parse those. */
const OWN_EMAIL_RE = /your code:|payment confirmed|bring this email|put [rcd]-?[a-z0-9]{4} in the/i;

function clean(text: string): string {
  return String(text)
    .replace(/\r/g, "")
    .replace(/\*/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ");
}

/** A line that is a date, a money figure, a link or a label is not the note. */
function looksLikeNote(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 300) return false;
  if (/^https?:\/\//i.test(l)) return false;
  if (/\$\s?[\d,]+\.\d{2}/.test(l)) return false;
  if (/^(transfer date|transaction|payment id|date|see transaction|view|reply|balance)/i.test(l)) return false;
  if (/^[A-Z][a-z]{2} \d{1,2}, \d{4}/.test(l)) return false;
  return true;
}

export function parseVenmoEmail(
  body: string,
  subject = "",
  messageId = ""
): ParsedZelle | null {
  const text = clean(body);
  const all = `${clean(subject)}\n${text}`;

  if (OWN_EMAIL_RE.test(all)) return null;
  if (!/venmo/i.test(all)) return null;

  const paid = PAID_YOU_RE.exec(all);
  if (!paid) return null;
  // "paid you" must not be a fragment of an outgoing or request email.
  if (NOT_INCOMING_RE.test(all) && !/paid you/i.test(all.replace(NOT_INCOMING_RE, ""))) {
    return null;
  }

  const amount = parseFloat(paid[2].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let sender = paid[1].trim();
  if (/^(you|venmo)$/i.test(sender)) sender = "";

  // The note: the first plausible line after the "paid you" line in the
  // body, otherwise any code-shaped token anywhere in the email.
  const lines = text.split("\n").map((l) => l.trim());
  const at = lines.findIndex((l) => /paid you \$/i.test(l));
  let memo = "";
  for (let i = at + 1; at >= 0 && i < Math.min(lines.length, at + 6); i++) {
    if (looksLikeNote(lines[i])) {
      memo = lines[i];
      break;
    }
  }
  if (!memo) {
    const codes = Array.from(all.toUpperCase().matchAll(CODE_RE), (x) => `${x[1]}-${x[2]}`);
    memo = Array.from(new Set(codes)).join(" ");
  }

  // Venmo's ids are long runs of digits. Without one, the email id keeps the
  // payment unique, exactly as the Zelle side does.
  const c = /(?:transaction|payment)\s*(?:id|number|no\.?|#)?\s*[:#]?\s*(\d{10,25})/i.exec(all);
  const confirmation = c?.[1] ?? (messageId ? `msg-${messageId}` : "");
  if (!confirmation) return null;

  return {
    amount,
    sender_name: sender.slice(0, 200),
    confirmation: confirmation.slice(0, 100),
    memo_raw: memo.slice(0, 500),
  };
}
