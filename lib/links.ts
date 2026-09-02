/**
 * External links used across the site.
 *
 * REGISTRATION_FORM_URL: the deployed Apps Script web app URL for the
 * BPAU event registration and Zelle payment form (apps-script/SETUP.md,
 * step 4, deployment 1). While it is empty, the Register & Pay buttons
 * stay hidden.
 */
export const REGISTRATION_FORM_URL =
  "https://script.google.com/macros/s/AKfycbwQXk-oyTnBCuG6i-onX1LVZ1ZmSOgZ1Nq31or6BdHcA8VWtwT2lNAmg_7CqIppZgimFA/exec";

/**
 * The BPAU payment admin panel (Apps Script deployment 2). Requires a
 * Google login that is listed in admin_emails on the Pricing tab, so
 * linking it from the site admin is a convenience, not an access grant.
 */
export const PAYMENT_ADMIN_URL =
  "https://script.google.com/macros/s/AKfycbxqus3LngPjYVy_MkCX4630QdjGfAhWqgX9WukVz_SrhQzqLAWXWjBTKdNtzoKDqtme0Q/exec?page=admin";
