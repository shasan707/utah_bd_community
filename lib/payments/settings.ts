import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { closesAt, formatDateOnly } from "./dates";
import type { Pricing } from "./pricing";

/**
 * Payment settings live in the payment_settings table as key/value text,
 * the replacement for the old Pricing tab. Admins edit them from
 * /admin/payments. This module reads and types them for the server.
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
  zelle_recipient: "",
  zelle_recipient_name: "",
  contact_email: "",
  pending_expiry_hours: "72",
  auto_confirm: "false",
};

export type Settings = {
  event_name: string;
  event_date: string;
  registration_closes: string;
  registration_open: boolean;
  price_adult: number;
  price_child: number;
  price_student: number;
  coupon_single: number;
  coupon_bundle_qty: number;
  coupon_bundle_price: number;
  zelle_recipient: string;
  zelle_recipient_name: string;
  contact_email: string;
  pending_expiry_hours: number;
  auto_confirm: boolean;
};

function toNumber(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: string): boolean {
  return /^(true|1|yes|on)$/i.test(v.trim());
}

export function parseSettings(raw: Partial<Record<string, string>>): Settings {
  const get = (k: SettingKey): string => {
    const v = raw[k];
    return v === undefined || v === null ? DEFAULT_SETTINGS[k] : String(v);
  };
  const d = DEFAULT_SETTINGS;
  return {
    event_name: get("event_name").trim(),
    event_date: get("event_date").trim(),
    registration_closes: get("registration_closes").trim(),
    registration_open: toBool(get("registration_open")),
    price_adult: toNumber(get("price_adult"), Number(d.price_adult)),
    price_child: toNumber(get("price_child"), Number(d.price_child)),
    price_student: toNumber(get("price_student"), Number(d.price_student)),
    coupon_single: toNumber(get("coupon_single"), Number(d.coupon_single)),
    coupon_bundle_qty: toNumber(
      get("coupon_bundle_qty"),
      Number(d.coupon_bundle_qty)
    ),
    coupon_bundle_price: toNumber(
      get("coupon_bundle_price"),
      Number(d.coupon_bundle_price)
    ),
    zelle_recipient: get("zelle_recipient").trim(),
    zelle_recipient_name: get("zelle_recipient_name").trim(),
    contact_email: get("contact_email").trim(),
    pending_expiry_hours: toNumber(
      get("pending_expiry_hours"),
      Number(d.pending_expiry_hours)
    ),
    auto_confirm: toBool(get("auto_confirm")),
  };
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await getServiceClient()
    .from("payment_settings")
    .select("key,value");
  if (error) {
    throw new ApiError(500, `Could not read payment settings: ${error.message}`);
  }
  const raw: Record<string, string> = {};
  for (const row of data ?? []) raw[String(row.key)] = String(row.value ?? "");
  return parseSettings(raw);
}

/** The subset of settings the public form may see, with formatted dates. */
export function publicPricing(s: Settings): Pricing {
  return {
    event_name: s.event_name,
    event_date: formatDateOnly(s.event_date),
    registration_closes: formatDateOnly(s.registration_closes),
    price_adult: s.price_adult,
    price_child: s.price_child,
    price_student: s.price_student,
    coupon_single: s.coupon_single,
    coupon_bundle_qty: s.coupon_bundle_qty,
    coupon_bundle_price: s.coupon_bundle_price,
    zelle_recipient: s.zelle_recipient,
    zelle_recipient_name: s.zelle_recipient_name,
    contact_email: s.contact_email,
  };
}

export type OpenState = "open" | "paused" | "closed";

/** paused: the switch is off. closed: the closing date has passed. */
export function openState(s: Settings, now = new Date()): OpenState {
  if (!s.registration_open) return "paused";
  if (now.getTime() > closesAt(s.registration_closes).getTime()) return "closed";
  return "open";
}

export type RegistrationStatus = {
  open: boolean;
  reason: OpenState | "unconfigured";
  pricing: Pricing | null;
};

/**
 * Safe for public server components: never throws. When the server has no
 * service key yet, the pages simply show registration as offline.
 */
export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  try {
    const s = await getSettings();
    const reason = openState(s);
    return { open: reason === "open", reason, pricing: publicPricing(s) };
  } catch (err) {
    console.error("getRegistrationStatus:", err instanceof Error ? err.message : err);
    return { open: false, reason: "unconfigured", pricing: null };
  }
}
