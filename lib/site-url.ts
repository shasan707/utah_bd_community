/**
 * The public address of the site, used wherever an absolute link is needed
 * (emails, QR codes). Set NEXT_PUBLIC_SITE_URL on Vercel to change it.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://utahbdcommunity.vercel.app"
).replace(/\/+$/, "");
