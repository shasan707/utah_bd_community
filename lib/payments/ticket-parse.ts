/**
 * Reads what a scanner saw. Client-safe (no server imports). The server does
 * the real validation; this only pulls a code and a token out of the text.
 *
 * Accepts the ticket link (https://site/ticket/R-7X3M?t=abc...), a bare code
 * typed by hand (r7x3m, R-7X3M), or "CODE TOKEN".
 */
export function parseScannedTicket(text: string): { code: string; token: string } | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const m = /\/ticket\/([^/?#]+)/i.exec(url.pathname);
    if (m) {
      return { code: tidy(decodeURIComponent(m[1])), token: url.searchParams.get("t") || "" };
    }
  } catch {
    /* not a URL */
  }

  const parts = raw.split(/\s+/);
  const code = tidy(parts[0]);
  if (!CODE_SHAPE.test(code)) return null;
  return { code, token: parts[1] || "" };
}

/** Same shape as the server's CODE_PATTERN: R, C or D, then four letters from the code alphabet. */
const CODE_SHAPE = /^[RCD]-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

/** Uppercases and puts the dash back: "r7x3m" becomes "R-7X3M". */
function tidy(v: string): string {
  const up = v.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (/^[A-Z]-/.test(up)) return up;
  if (/^[A-Z][A-Z0-9]{4}$/.test(up)) return `${up[0]}-${up.slice(1)}`;
  return up;
}
