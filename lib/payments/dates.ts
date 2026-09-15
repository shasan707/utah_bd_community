/**
 * Date helpers for the payment system. Dates in settings are stored as
 * yyyy-mm-dd text. Deadlines are end of day in the event's time zone.
 */

export const EVENT_TIME_ZONE = "America/Denver";

function parseDateOnly(v: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "2026-10-18" becomes "Oct 18, 2026". Anything else is returned as-is. */
export function formatDateOnly(v: string): string {
  const p = parseDateOnly(v);
  if (!p) return String(v);
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date in the event time zone, e.g. "Sep 3, 2026". */
export function formatInEventZone(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  });
}

/** Minutes east of UTC for the event time zone at a given instant. */
function zoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return Math.round((wall - at.getTime()) / 60000);
}

/** End of the given day (23:59:59.999) in the event time zone, as an instant. */
export function closesAt(v: string): Date {
  const p = parseDateOnly(v);
  if (!p) return new Date(Date.UTC(2100, 0, 1));
  const guess = Date.UTC(p.y, p.m - 1, p.d, 23, 59, 59, 999);
  const offset = zoneOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000);
}

/**
 * What an admin typed into a datetime-local box, read as Utah wall time and
 * returned as an ISO instant. The browser would otherwise read it in the
 * admin's own zone, and an admin six hours ahead in Bangladesh typing noon
 * was storing midnight in Utah. Returns "" for anything it cannot read.
 */
export function eventZoneInputToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(local).trim());
  if (!m) return "";
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offset = zoneOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000).toISOString();
}

/** The reverse: an instant as the "yyyy-mm-ddThh:mm" a datetime-local box shows, in Utah time. */
export function isoToEventZoneInput(iso: string): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
