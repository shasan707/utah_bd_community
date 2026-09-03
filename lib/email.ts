import "server-only";

/**
 * Transactional email behind one small interface, so the provider can change
 * without touching the payment code. Chosen by environment variables:
 *
 *   EMAIL_PROVIDER = resend | brevo   (unset means "do not send")
 *   EMAIL_API_KEY  = the provider's API key
 *   EMAIL_FROM     = "BPAU <noreply@example.org>" (a sender the provider has verified)
 *
 * sendEmail never throws. When nothing is configured it reports no_provider,
 * and callers keep going, because a registration must never fail just because
 * the email copy could not be sent.
 */

export type EmailProvider = "resend" | "brevo";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export type EmailResult =
  | { sent: true; provider: EmailProvider; id?: string }
  | {
      sent: false;
      reason: "no_provider" | "provider_error" | "invalid_recipient";
      detail?: string;
    };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIMEOUT_MS = 10_000;

/** The configured provider, or null when email is switched off. */
export function emailProvider(): EmailProvider | null {
  const name = (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  const ready = Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
  if (!ready) return null;
  if (name === "resend" || name === "brevo") return name;
  return null;
}

/** Splits "Name <address>" into its parts. A bare address gets the BPAU name. */
function parseFrom(from: string): { name: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) {
    return { name: match[1].trim() || "BPAU", email: match[2].trim() };
  }
  return { name: "BPAU", email: from.trim() };
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = emailProvider();
  if (!provider) return { sent: false, reason: "no_provider" };
  if (!EMAIL_RE.test(msg.to)) {
    return { sent: false, reason: "invalid_recipient", detail: msg.to };
  }

  const apiKey = process.env.EMAIL_API_KEY as string;
  const from = process.env.EMAIL_FROM as string;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let res: Response;
    if (provider === "resend") {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
        signal: controller.signal,
      });
    } else {
      res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: parseFrom(from),
          to: [{ email: msg.to }],
          subject: msg.subject,
          textContent: msg.text,
          ...(msg.replyTo ? { replyTo: { email: msg.replyTo } } : {}),
        }),
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      return {
        sent: false,
        reason: "provider_error",
        detail: `${provider} ${res.status} ${body}`.trim(),
      };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const id = data.id ?? data.messageId;
    return { sent: true, provider, id: id ? String(id) : undefined };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { sent: false, reason: "provider_error", detail: `${provider} ${detail}` };
  } finally {
    clearTimeout(timer);
  }
}
