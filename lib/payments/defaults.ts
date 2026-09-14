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
  "event_time",
  "event_venue",
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
  "sms_enabled",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  event_name: "2026 SLC BD Picnic",
  event_date: "2026-10-03",
  event_time: "12:00 PM",
  event_venue: "South Fork Park, 4988 S Fork Rd, Provo, UT 84604",
  registration_closes: "2026-09-28",
  registration_open: "false",
  price_adult: "20",
  price_child: "0",
  price_student: "12",
  coupon_single: "2",
  coupon_bundle_qty: "10",
  coupon_bundle_price: "15",
  zelle_recipient: "bpau.pay@gmail.com",
  zelle_recipient_name: "Qudrat E Alahy Ratul",
  contact_email: "bpau@gmail.com",
  pending_expiry_hours: "72",
  auto_confirm: "false",
  // Texting stays off until someone turns it on in Settings, so adding
  // Twilio to the server changes nothing by itself.
  sms_enabled: "false",
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
