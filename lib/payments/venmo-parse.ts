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

/**
 * "Rahim Uddin paid you $20.00", either capitalisation of "you". A name
 * word may be a single initial ("Qudrat E Alahy Ratul"), which is why the
 * word pattern allows one letter.
 */
const PAID_YOU_RE =
  /([A-Z][A-Za-z.'-]*(?:[ \t]+[A-Z][A-Za-z.'-]*){0,5})[ \t]+paid[ \t]+you[ \t]+\$\s?([\d,]+\.\d{2})/i;

/**
 * The Venmo account belongs to a committee member, so its notifications
 * reach the relay's inbox by forwarding. Gmail's forward puts the original
 * headers at the top of the body ("From:", "Date:", "Subject:", "To:"),
 * and "Fwd:" on the subject. Those header lines are dropped before the
 * note is looked for, or "To: <address>" would be taken as the note and
 * the code in the real note never seen.
 */
function stripForwardHeaders(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*-{2,}\s*forwarded message\s*-{2,}\s*$/i.test(l))
    .filter((l) => !/^\s*(from|to|cc|bcc|date|sent|subject)\s*:/i.test(l))
    .join("\n");
}

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

/**
 * A line that is a date, a money figure, a link, an image placeholder or a
 * label is not the note.
 *
 * The real Venmo email (captured 19 September 2026, see the fixture in
 * tests/suite-venmo.mts) prints the amount as four lines on their own,
 * "$" then "22" then "." then "00", and Gmail's text view turns every
 * picture into "[image: ...]". Both sit between the "paid you" line and
 * the note, so both are named here.
 */
function looksLikeNote(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 300) return false;
  if (/^<?https?:\/\//i.test(l)) return false;
  if (/^\[image:/i.test(l)) return false;
  if (/\$\s?[\d,]+\.\d{2}/.test(l)) return false;
  if (/^(\$|\.|\d{1,6})$/.test(l)) return false;
  if (/^(transfer date|transaction|payment id|date|see transaction|view|reply|balance|sent to|money credited)/i.test(l)) return false;
  if (/^[A-Z][a-z]{2} \d{1,2}, \d{4}/.test(l)) return false;
  return true;
}

/** Past this line the email is boilerplate; a note is never found after it. */
const NOTE_ENDS_RE = /^(see transaction|money credited|transaction details)/i;

export function parseVenmoEmail(
  body: string,
  subject = "",
  messageId = ""
): ParsedZelle | null {
  const text = stripForwardHeaders(clean(body));
  const all = `${clean(subject).replace(/^\s*(fwd?|fw)\s*:\s*/i, "")}\n${text}`;

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

  // The note: the first plausible line after the LAST "paid you" line in
  // the body. The email says "paid you" three times, twice in a heading
  // that repeats the subject and once just above the amount block, and the
  // note follows that last one. The scan stops at the boilerplate that
  // follows the note, so an empty note never turns into "Money credited".
  const lines = text.split("\n").map((l) => l.trim());
  let at = -1;
  lines.forEach((l, i) => {
    if (/paid you\b/i.test(l)) at = i;
  });
  let memo = "";
  for (let i = at + 1; at >= 0 && i < Math.min(lines.length, at + 12); i++) {
    if (NOTE_ENDS_RE.test(lines[i])) break;
    if (looksLikeNote(lines[i])) {
      memo = lines[i];
      break;
    }
  }
  // Any code-shaped token in the email that the note did not carry is added
  // to it, so the matcher sees the code even if the note was mistaken for
  // something else. "R-0000" is not a code (0 is not in the alphabet) and is
  // left alone.
  const codes = Array.from(all.toUpperCase().matchAll(CODE_RE), (x) => `${x[1]}-${x[2]}`);
  const missing = Array.from(new Set(codes)).filter(
    (c) => !memo.toUpperCase().replace(/[^A-Z0-9]/g, "").includes(c.replace("-", ""))
  );
  if (missing.length) memo = [memo, ...missing].filter(Boolean).join(" ");

  // Venmo's transaction id follows a "Transaction ID" label, on the same
  // line or the next: a long run of digits for a payment, letters and digits
  // for a transfer. Without one, the email id keeps the payment unique,
  // exactly as the Zelle side does.
  const c =
    /(?:transaction|payment)\s*(?:id|number|no\.?|#)?\s*[:#]?\s*(?=[A-Z0-9-]*\d)([A-Z0-9][A-Z0-9-]{9,24})\b/i.exec(all);
  const confirmation = c?.[1] ?? (messageId ? `msg-${messageId}` : "");
  if (!confirmation) return null;

  return {
    amount,
    sender_name: sender.slice(0, 200),
    confirmation: confirmation.slice(0, 100),
    memo_raw: memo.slice(0, 500),
  };
}
