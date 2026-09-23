import "server-only";
import { ApiError, getServiceClient } from "@/lib/supabase-server";
import { fullAddress, mapsUrl, placeLine } from "@/lib/address";
import { getEvents, next } from "@/lib/content";
import { formatTime } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import { closesAt, formatDateOnly, isoToEventZoneInput } from "./dates";
import { DEFAULT_SETTINGS, withDefaults, type SettingKey } from "./defaults";
import type { Pricing } from "./pricing";

/**
 * Payment settings live in the payment_settings table as key/value text,
 * the replacement for the old Pricing tab. Admins edit them from
 * /admin/payments. This module reads and types them for the server.
 *
 * A missing or blank row falls back to DEFAULT_SETTINGS (see defaults.ts),
 * the same pre-filled values the first version had, so the Zelle recipient,
 * the name, and the contact email work without anyone typing them.
 */

export { DEFAULT_SETTINGS, SETTING_KEYS, type SettingKey } from "./defaults";

export type Settings = {
  event_name: string;
  event_date: string;
  event_time: string;
  event_venue: string;
  registration_closes: string;
  registration_open: boolean;
  price_adult: number;
  price_child: number;
  price_youth: number;
  coupon_single: number;
  coupon_bundle_qty: number;
  coupon_bundle_price: number;
  zelle_recipient: string;
  zelle_recipient_name: string;
  /** Blank means Venmo is not offered. See lib/payments/defaults.ts. */
  venmo_handle: string;
  venmo_name: string;
  contact_email: string;
  /**
   * From the event itself, not from the settings table (see getSettings):
   * the venue name line, the street address, the map link and the short
   * link to the event page. Blank when there is no event to read.
   */
  event_place: string;
  event_address: string;
  event_map_url: string;
  event_url: string;
  pending_expiry_hours: number;
  auto_confirm: boolean;
  sms_enabled: boolean;
};

function toNumber(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: string): boolean {
  return /^(true|1|yes|on)$/i.test(v.trim());
}

/**
 * Accepts whatever the admin pastes, "@evue007", "evue007" or the whole
 * "https://venmo.com/u/evue007", and keeps the handle alone. Venmo handles
 * are letters, digits, hyphens and underscores.
 */
function cleanHandle(v: string): string {
  const h = v
    .trim()
    .replace(/^https?:\/\/(www\.)?venmo\.com\/(u\/)?/i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(h) ? h : "";
}

export function parseSettings(raw: Partial<Record<string, string>>): Settings {
  const filled = withDefaults(raw);
  const get = (k: SettingKey): string => filled[k];
  const d = DEFAULT_SETTINGS;
  return {
    event_name: get("event_name").trim(),
    event_date: get("event_date").trim(),
    event_time: get("event_time").trim(),
    event_venue: get("event_venue").trim(),
    registration_closes: get("registration_closes").trim(),
    registration_open: toBool(get("registration_open")),
    price_adult: toNumber(get("price_adult"), Number(d.price_adult)),
    price_child: toNumber(get("price_child"), Number(d.price_child)),
    price_youth: toNumber(get("price_youth"), Number(d.price_youth)),
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
    venmo_handle: cleanHandle(get("venmo_handle")),
    venmo_name: get("venmo_name").trim(),
    contact_email: get("contact_email").trim(),
    // Filled from the event by getSettings; blank until then.
    event_place: "",
    event_address: "",
    event_map_url: "",
    event_url: "",
    pending_expiry_hours: toNumber(
      get("pending_expiry_hours"),
      Number(d.pending_expiry_hours)
    ),
    auto_confirm: toBool(get("auto_confirm")),
    sms_enabled: toBool(get("sms_enabled")),
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
  return withCurrentEvent(parseSettings(raw));
}

/**
 * The event's own name, date, time and place, laid over the four settings
 * of the same name. This is what makes the register page, both emails,
 * both texts, the ticket page and the tracker say exactly what the event
 * page says: they all read these fields, and the event page reads the
 * event. Before this the messages read the settings table, the page read
 * the event, and the two drifted (11:00 in one, 10:00 in the other).
 *
 * The four settings remain as the fallback for a site with no event yet.
 * Failure here is never fatal: a bad read leaves the settings as typed.
 */
async function withCurrentEvent(s: Settings): Promise<Settings> {
  try {
    const ev = next(await getEvents());
    if (!ev?.date) return s;
    return {
      ...s,
      event_name: ev.title?.trim() || s.event_name,
      event_date: isoToEventZoneInput(ev.date).slice(0, 10),
      event_time: formatTime(ev.date),
      event_venue: fullAddress(ev),
      event_place: placeLine(ev),
      event_address: ev.address?.trim() ?? "",
      event_map_url: mapsUrl(ev),
      event_url: `${SITE_URL}/event`,
    };
  } catch {
    return s;
  }
}

/** The subset of settings the public form may see, with formatted dates. */
export function publicPricing(s: Settings): Pricing {
  return {
    event_name: s.event_name,
    event_date: formatDateOnly(s.event_date),
    event_time: s.event_time,
    event_venue: s.event_venue,
    registration_closes: formatDateOnly(s.registration_closes),
    price_adult: s.price_adult,
    price_child: s.price_child,
    price_youth: s.price_youth,
    coupon_single: s.coupon_single,
    coupon_bundle_qty: s.coupon_bundle_qty,
    coupon_bundle_price: s.coupon_bundle_price,
    zelle_recipient: s.zelle_recipient,
    zelle_recipient_name: s.zelle_recipient_name,
    venmo_handle: s.venmo_handle,
    venmo_name: s.venmo_name,
    contact_email: s.contact_email,
  };
}

export type OpenState = "open" | "paused" | "closed";

/** paused: the switch is off. closed: the closing date has passed. */
/**
 * paused: the switch is off. Since 23 September 2026 the closing date is a
 * message, not a switch: registration stays open past it until the admin
 * turns it off, or the event has started (canRegisterFor checks that). The
 * pages still say "Registration closes <date>", on purpose, as the nudge.
 */
export function openState(s: Settings): OpenState {
  if (!s.registration_open) return "paused";
  return "open";
}

export type RegistrationStatus = {
  open: boolean;
  reason: OpenState | "unconfigured";
  pricing: Pricing | null;
};

/**
 * Whether a page may offer to register people for one event.
 *
 * Registration is a site-wide setting rather than a flag on the event row, so
 * the only thing that varies per event is whether it is still ahead: a
 * gathering that has already happened must never offer a Register button.
 * Both the home page and an event's own page ask through here, so the two
 * cannot drift apart.
 */
export function canRegisterFor(
  status: RegistrationStatus,
  eventDate: string,
  now = new Date()
): boolean {
  return Boolean(
    status.open &&
      status.pricing &&
      new Date(eventDate).getTime() > now.getTime()
  );
}

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
