import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site-url";

/**
 * Signed ticket links. The QR in the ticket email carries the code plus a
 * short signature made with a server secret, so a QR someone made up for
 * another person's code is rejected before the database is even asked.
 *
 * The secret is TICKET_SECRET, or CRON_SECRET when that is not set, so no
 * extra setup is needed. Changing the secret makes every QR sent so far
 * invalid; the ticket number itself keeps working at the desk.
 */

export const TOKEN_LENGTH = 12;

function secret(): string {
  const s =
    process.env.TICKET_SECRET ||
    process.env.CRON_SECRET ||
    process.env.ZELLE_INBOUND_SECRET;
  if (!s) throw new Error("TICKET_SECRET (or CRON_SECRET) is not set, so tickets cannot be signed.");
  return s;
}

/** The signature for one code: 12 URL-safe characters. */
export function ticketToken(code: string): string {
  return createHmac("sha256", secret())
    .update(`ticket:${code.toUpperCase()}`)
    .digest("base64url")
    .slice(0, TOKEN_LENGTH);
}

/** True when the token was made for this code with our secret. */
export function verifyTicketToken(code: string, token: string): boolean {
  if (!token || token.length !== TOKEN_LENGTH) return false;
  const expected = Buffer.from(ticketToken(code));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The page the QR opens: the ticket, large, with the QR on it. */
export function ticketUrl(code: string): string {
  return `${SITE_URL}/ticket/${encodeURIComponent(code)}?t=${ticketToken(code)}`;
}

/** The QR image the email embeds. Served by the site because mail apps drop embedded images. */
export function qrImageUrl(code: string): string {
  return `${SITE_URL}/api/ticket/qr?code=${encodeURIComponent(code)}&t=${ticketToken(code)}`;
}

/** Both links, or null when no secret is configured, so an email never fails over a QR. */
export function ticketLinks(code: string): { ticket: string; qr: string } | null {
  try {
    return { ticket: ticketUrl(code), qr: qrImageUrl(code) };
  } catch (err) {
    console.error("ticketLinks:", err instanceof Error ? err.message : err);
    return null;
  }
}
