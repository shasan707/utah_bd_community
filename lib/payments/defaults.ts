/**
 * Default payment settings: the same values the first version seeded into
 * its Pricing tab, so nothing has to be typed before registration opens.
 *
 * This file has no server-only import on purpose. The admin form uses it to
 * show the value the site will actually use when a row is missing or blank.
 */

export const SETTING_KEYS = [
  "event_name",
  "event_date",
  "registration_closes",
  "registration_open",
  "price_adult",
  "price_child",
  "price_student",
  "coupon_single",
  "coupon_bundle_qty",
  "coupon_bundle_price",
  "zelle_recipient",
  "zelle_recipient_name",
  "contact_email",
  "pending_expiry_hours",
  "auto_confirm",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  event_name: "BPAU Eid Reunion 2026",
  event_date: "2026-10-18",
  registration_closes: "2026-10-11",
  registration_open: "false",
  price_adult: "25",
  price_child: "10",
  price_student: "15",
  coupon_single: "2",
  coupon_bundle_qty: "10",
  coupon_bundle_price: "18",
  zelle_recipient: "bpau.pay@gmail.com",
  zelle_recipient_name: "Qudrat E Alahy Ratul",
  contact_email: "bpau@gmail.com",
  pending_expiry_hours: "72",
  auto_confirm: "false",
};

/**
 * Fills in every known key. A missing, null, or blank value becomes its
 * default, exactly as a blank Pricing cell did in the first version. Unknown
 * keys are kept as they are.
 */
export function withDefaults(
  raw: Partial<Record<string, string | null | undefined>>
): Record<SettingKey, string> & Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") out[k] = String(v);
  }
  for (const k of SETTING_KEYS) {
    if (!(k in out)) out[k] = DEFAULT_SETTINGS[k];
  }
  return out as Record<SettingKey, string> & Record<string, string>;
}
