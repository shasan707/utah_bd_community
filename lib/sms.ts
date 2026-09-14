import "server-only";

/**
 * Text messages through Twilio.
 *
 * Configured entirely by server environment variables, none of which carry the
 * NEXT_PUBLIC_ prefix, so the account details never reach a browser. The
 * "server-only" import above makes the build fail outright if a client
 * component ever tries to import this file.
 *
 *   TWILIO_ACCOUNT_SID    the account the message is billed to
 *   TWILIO_AUTH_TOKEN     the secret, or TWILIO_API_KEY_SID plus
 *                         TWILIO_API_KEY_SECRET, which is the safer pair
 *                         because it can be revoked on its own
 *   TWILIO_FROM_NUMBER    the verified sending number, in +1... form
 *
 * sendSms never throws and never retries. A registration must succeed even
 * when Twilio is down, out of credit, or switched off, so every caller treats
 * a failed text as a note on the row rather than an error for the member.
 */

export type SmsResult =
  | { sent: true; id: string }
  | {
      sent: false;
      reason: "not_configured" | "invalid_number" | "opted_out" | "provider_error";
      detail?: string;
    };

const TIMEOUT_MS = 10_000;

/** True when all three values are present, so texting can be attempted. */
export function smsConfigured(): boolean {
  const hasSecret = Boolean(
    process.env.TWILIO_AUTH_TOKEN ||
      (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
  );
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && hasSecret && process.env.TWILIO_FROM_NUMBER
  );
}

/**
 * Turns what the form stored into the international form Twilio needs.
 * Numbers are kept as bare digits in the database, so "8015550123" becomes
 * "+18015550123". Anything that is not a plausible US number returns null
 * rather than being guessed at.
 */
export function toE164(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function credentials(): { user: string; pass: string; account: string } | null {
  const account = process.env.TWILIO_ACCOUNT_SID;
  if (!account) return null;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  if (keySid && keySecret) return { user: keySid, pass: keySecret, account };
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token) return { user: account, pass: token, account };
  return null;
}

/** Twilio's numeric codes for the two cases worth naming on the admin screen. */
const OPTED_OUT = 21610;

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!smsConfigured()) return { sent: false, reason: "not_configured" };

  const number = toE164(to);
  if (!number) return { sent: false, reason: "invalid_number", detail: to.slice(0, 40) };

  const creds = credentials();
  if (!creds) return { sent: false, reason: "not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.account}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${creds.user}:${creds.pass}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: number,
          From: process.env.TWILIO_FROM_NUMBER as string,
          Body: body,
        }),
        signal: controller.signal,
      }
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const code = Number(data.code);
      if (code === OPTED_OUT) {
        return { sent: false, reason: "opted_out", detail: "replied STOP" };
      }
      const message = String(data.message || `HTTP ${res.status}`);
      return {
        sent: false,
        reason: "provider_error",
        detail: `${code || res.status} ${message}`.slice(0, 300),
      };
    }
    return { sent: true, id: String(data.sid || "") };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { sent: false, reason: "provider_error", detail: detail.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}
