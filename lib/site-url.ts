/**
 * The public address of the site, used wherever an absolute link is needed
 * (emails, QR codes). Set NEXT_PUBLIC_SITE_URL on Vercel to change it. The
 * vercel.app addresses stay attached to the project, so links made before a
 * move keep working.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://bdutah.jotillabs.com"
).replace(/\/+$/, "");
