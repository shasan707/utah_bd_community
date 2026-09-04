import "server-only";
import { createTransport } from "nodemailer";

/**
 * Transactional email behind one small interface, so the sender can change
 * without touching the payment code. Chosen by environment variables:
 *
 *   EMAIL_PROVIDER = gmail | resend | brevo   (unset means "do not send")
 *
 *   gmail:  EMAIL_USER (the Gmail address) and EMAIL_APP_PASSWORD (a 16
 *           character App Password from that account; 2-Step Verification
 *           must be on). Mail is sent through smtp.gmail.com. Gmail always
 *           uses the account itself as the address, so EMAIL_FROM only
 *           changes the display name, e.g. "BPAU <bpau.pay@gmail.com>".
 *   resend: EMAIL_API_KEY and EMAIL_FROM on a domain verified at Resend.
 *   brevo:  EMAIL_API_KEY and EMAIL_FROM on a verified sender.
 *
 * sendEmail never throws. When nothing is configured it reports no_provider,
 * and callers keep going, because a registration must never fail just because
 * the email copy could not be sent.
 */

export type EmailProvider = "gmail" | "resend" | "brevo";

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
  if (name === "gmail") {
    return process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD ? "gmail" : null;
  }
  if (name === "resend" || name === "brevo") {
    return process.env.EMAIL_API_KEY && process.env.EMAIL_FROM ? name : null;
  }
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

function failure(provider: EmailProvider, detail: string): EmailResult {
  return { sent: false, reason: "provider_error", detail: `${provider} ${detail}`.slice(0, 300) };
}

async function sendViaGmail(msg: EmailMessage): Promise<EmailResult> {
  const user = process.env.EMAIL_USER as string;
  const pass = process.env.EMAIL_APP_PASSWORD as string;
  const fromName = process.env.EMAIL_FROM ? parseFrom(process.env.EMAIL_FROM).name : "BPAU";
  const transport = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS * 2,
  });
  try {
    const info = await transport.sendMail({
      from: { name: fromName, address: user },
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    });
    return { sent: true, provider: "gmail", id: info.messageId };
  } catch (err) {
    return failure("gmail", err instanceof Error ? err.message : String(err));
  } finally {
    transport.close();
  }
}

async function sendViaHttp(
  provider: "resend" | "brevo",
  msg: EmailMessage
): Promise<EmailResult> {
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
      return failure(provider, `${res.status} ${body}`.trim());
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const id = data.id ?? data.messageId;
    return { sent: true, provider, id: id ? String(id) : undefined };
  } catch (err) {
    return failure(provider, err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const provider = emailProvider();
  if (!provider) return { sent: false, reason: "no_provider" };
  if (!EMAIL_RE.test(msg.to)) {
    return { sent: false, reason: "invalid_recipient", detail: msg.to };
  }
  if (provider === "gmail") return sendViaGmail(msg);
  return sendViaHttp(provider, msg);
}
