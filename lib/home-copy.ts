import type { CommunityEvent } from "@/data/events";

/**
 * Display copy used by the home page only.
 *
 * These are presentation overrides, not data edits: /events, /events/[slug]
 * and /gallery keep reading the underlying records unchanged, and the
 * overrides still apply when Supabase serves the live data.
 */

/** Shown instead of a venue until an event has a confirmed address. */
export const HOME_VENUE = "Venue announced with registration";

/**
 * The venue line for the home page. An event with a published street address
 * shows the real place; the rest stay behind the placeholder above.
 */
export function homeVenue(event: CommunityEvent): string {
  return event.address ? `${event.venue}, ${event.city}` : HOME_VENUE;
}

export const GALLERY_PLACEHOLDER_NOTE =
  "placeholder — real photos coming after our next event";

const TITLE_OVERRIDES: Record<string, string> = {
  "ekushey-february-2027":
    "Ekushey February · International Mother Language Day",
};

/** Dates that need a qualifier next to them on the home page. */
const DATE_NOTES: Record<string, string> = {
  "boishakhi-mela-2027": " (celebrated on the weekend)",
};

export function homeTitle(event: CommunityEvent): string {
  return TITLE_OVERRIDES[event.slug] ?? event.title;
}

export function homeDateNote(event: CommunityEvent): string {
  return DATE_NOTES[event.slug] ?? "";
}

/** Home-page view of an event: overridden title and venue. */
export function homeEvent(event: CommunityEvent): CommunityEvent {
  return { ...event, title: homeTitle(event), venue: homeVenue(event) };
}
