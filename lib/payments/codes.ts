import "server-only";
import { randomInt } from "node:crypto";

/** No 0, O, 1, I or L, so codes survive handwriting and phone calls. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const CODE_PATTERN = /^[RCD]-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

/** A fresh candidate such as "R-7X3M". Uniqueness is enforced by the insert. */
export function randomCode(prefix: "R" | "C" | "D"): string {
  let body = "";
  for (let i = 0; i < 4; i++) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}

/** Accepts "r7x3m", "R7X3M" or "R-7X3M" and returns "R-7X3M". */
export function normalizeCode(input: string): string {
  const clean = String(input).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 5) return `${clean[0]}-${clean.slice(1)}`;
  return String(input).trim().toUpperCase();
}
