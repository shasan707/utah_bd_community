import type { CommunityEvent } from "@/data/events";

/**
 * Display copy used by the home page only.
 *
 * These are presentation overrides, not data edits: /events, /events/[slug]
 * and /gallery keep reading the underlying records unchanged, and the
 * overrides still apply when Supabase serves the live data.
 */

/** Venues are not published on the home page until registration opens. */
export const HOME_VENUE = "Venue announced with registration";

export const GALLERY_PLACEHOLDER_NOTE =
  "placeholder — real photos coming after our next event";

export const OPENNESS_NOTE =
  "Most BAU events are open to everyone — look for the “Open to all” badge.";

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

/** Events are open to everyone unless the record says otherwise. */
export function homeOpenness(event: CommunityEvent): "Open to all" | "Members" {
  return event.membersOnly ? "Members" : "Open to all";
}

/** Home-page view of an event: overridden title and withheld venue. */
export function homeEvent(event: CommunityEvent): CommunityEvent {
  return { ...event, title: homeTitle(event), venue: HOME_VENUE };
}
