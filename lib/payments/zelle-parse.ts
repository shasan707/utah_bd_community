/**
 * Reads a bank's "you received money with Zelle" email.
 *
 * Banks change their wording, and the exact Wells Fargo layout is not
 * published, so this looks for each piece loosely instead of expecting one
 * fixed template. It stays strict about one thing: it only accepts emails
 * about money coming in, never requests, outgoing payments, or the site's
 * own emails to members.
 *
 * Pure function with no server imports, so it can be unit tested on its own.
 */

export type ParsedZelle = {
  amount: number;
  sender_name: string;
  confirmation: string;
  memo_raw: string;
};

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_RE = new RegExp(`\\b([RCD])-?([${CODE_ALPHABET}]{4})\\b`, "gi");

/**
 * Every 4 and 5 character window of the memo with spaces and punctuation
 * removed, so "for r7x3m please", "R-7X3M" and "7x3m" all find the code.
 */
export function extractCandidates(memo: string): Set<string> {
  const clean = String(memo).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ok = (ch: string) => CODE_ALPHABET.includes(ch);
  const out = new Set<string>();
  for (let i = 0; i + 4 <= clean.length; i++) {
    const four = clean.slice(i, i + 4);
    if ([...four].every(ok)) out.add(four);
    if (i + 5 <= clean.length) {
      const five = clean.slice(i, i + 5);
      if ("RCD".includes(five[0]) && [...five.slice(1)].every(ok)) out.add(five);
    }
  }
  return out;
}

/**
 * True when some 4-character window of the memo differs from the code's
 * body in exactly one position: "R-PQ2Q" typed for "R-PQ2G". Callers only
 * trust this together with a matching amount and sender name.
 */
export function memoNearCode(memo: string, code: string): boolean {
  const clean = String(memo).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = String(code).toUpperCase().replace("-", "").slice(1);
  if (body.length !== 4) return false;
  for (let i = 0; i + 4 <= clean.length; i++) {
    let diff = 0;
    for (let k = 0; k < 4; k++) if (clean[i + k] !== body[k]) diff++;
    if (diff === 1) return true;
  }
  return false;
}

const INCOMING_RE =
  /sent you|you received|you've received|you have received|has sent|received money|received a payment|money received|payment received|was deposited|has been deposited/i;
const NOT_INCOMING_RE =
  /request(?:ed|s)?\s+(?:\$|money|payment)|payment request|you sent|you paid|payment sent|you requested/i;
const OWN_EMAIL_RE =
  /your code:|put [rcd]-?[a-z0-9]{4} in the zelle|payment confirmed|bring this email/i;

function clean(text: string): string {
  return String(text)
    .replace(/\r/g, "")
    // Gmail's text view of the bank's HTML wraps bold values in asterisks:
    // "Confirmation: *JPM99cvo5gg9*". Drop them.
    .replace(/\*/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ");
}

export function parseZelleEmail(
  body: string,
  subject = "",
  messageId = ""
): ParsedZelle | null {
  const text = clean(body);
  const all = `${clean(subject)}\n${text}`;

  if (OWN_EMAIL_RE.test(all)) return null;
  if (!INCOMING_RE.test(all)) return null;
  if (NOT_INCOMING_RE.test(all) && !/sent you|you received|received money/i.test(all)) {
    return null;
  }
  if (!/zelle/i.test(all) && !/sent you \$/i.test(all)) return null;

  // Amount: prefer the figure right after the "received" phrase.
  const near =
    /(?:sent you|you received|you've received|you have received|received|has sent|amount(?: received)?)[^$\n]{0,80}\$\s?([\d,]+\.\d{2})/i.exec(
      all
    );
  const any = /\$\s?([\d,]+\.\d{2})/.exec(all);
  const amountText = near?.[1] ?? any?.[1];
  if (!amountText) return null;
  const amount = parseFloat(amountText.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Sender: "Rahim Uddin sent you", "Sender: Rahim Uddin", "from Rahim Uddin".
  // Names are capitalised words on one line; [ \t] keeps a preceding line out.
  const s1 =
    /([A-Z][A-Za-z.'-]+(?:[ \t]+[A-Z][A-Za-z.'-]+){0,4})[ \t]+(?:has[ \t]+)?sent you\b/.exec(all);
  const s2 = /(?:^|\n)[ \t]*(?:sender|from)[ \t]*[:\-][ \t]*([^\n$]{2,60}?)[ \t]*(?:\n|$)/i.exec(text);
  const s3 =
    /(?:received|payment|money)[^\n]{0,40}?\bfrom[ \t]+([A-Z][A-Za-z.'-]+(?:[ \t]+[A-Z][A-Za-z.'-]+){0,4})/.exec(
      all
    );
  let sender = (s1?.[1] ?? s2?.[1] ?? s3?.[1] ?? "").trim();
  if (/^(you|wells fargo|zelle|bank)$/i.test(sender)) sender = "";

  // Confirmation: any labelled reference with a digit in it. Without one, the
  // email id still makes the payment unique.
  const c =
    /(?:(?:confirmation|reference|trace)(?:\s*(?:number|no\.?|#|id|code))?|(?:transaction|payment)\s*(?:number|no\.?|#|id|code))\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)([A-Za-z0-9][A-Za-z0-9-]{5,})/i.exec(
      all
    );
  const confirmation = c?.[1] ?? (messageId ? `msg-${messageId}` : "");
  if (!confirmation) return null;

  // Memo: a labelled line, a quoted message, or any code-shaped token.
  const m =
    /(?:memo|message|note|description|comment)[^:\n]{0,20}:\s*([^\n]{1,300})/i.exec(text);
  let memo = m?.[1]?.trim() ?? "";
  if (!memo) {
    const q = /[“"]([^”"\n]{1,200})[”"]/.exec(text);
    memo = q?.[1]?.trim() ?? "";
  }
  if (!memo) {
    const codes = Array.from(all.toUpperCase().matchAll(CODE_RE), (x) => `${x[1]}-${x[2]}`);
    memo = Array.from(new Set(codes)).join(" ");
  }

  return {
    amount,
    sender_name: sender.slice(0, 200),
    confirmation: confirmation.slice(0, 100),
    memo_raw: memo.slice(0, 500),
  };
}
