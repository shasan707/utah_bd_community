import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { events as fallbackEvents, type CommunityEvent } from "@/data/events";
import { gallery as fallbackGallery, type GalleryItem } from "@/data/gallery";
import {
  committee as fallbackCommittee,
  type CommitteeMember,
} from "@/data/committee";
import type { Palette } from "@/lib/palette";

const palettes: Palette[] = ["green", "red", "gold", "teal"];

function asPalette(value: unknown, fallback: Palette): Palette {
  return palettes.includes(value as Palette) ? (value as Palette) : fallback;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * Content loaders: read live data from Supabase when it exists,
 * otherwise fall back to the placeholder data files.
 */

export async function getEvents(): Promise<CommunityEvent[]> {
  if (!supabaseConfigured) return fallbackEvents;
  try {
    const { data, error } = await getSupabase()
      .from("events")
      .select("*")
      .order("date", { ascending: true });
    if (error || !data || data.length === 0) return fallbackEvents;
    return data.map((row, i) => ({
      slug: row.slug,
      title: row.title,
      banglaTitle: row.short_name || row.title,
      date: row.date,
      endTime: row.end_time || undefined,
      venue: row.venue || "Venue to be announced",
      city: row.city || "Salt Lake City, UT",
      tag: row.tag || "Event",
      free: Boolean(row.free),
      blurb: row.blurb || "",
      description: Array.isArray(row.description)
        ? row.description.map(String)
        : [],
      palette: asPalette(row.palette, palettes[i % palettes.length]),
      imageUrl: row.image_url || undefined,
    }));
  } catch {
    return fallbackEvents;
  }
}

export async function getEventBySlug(
  slug: string
): Promise<CommunityEvent | undefined> {
  const all = await getEvents();
  return all.find((e) => e.slug === slug);
}

export function upcoming(
  list: CommunityEvent[],
  now = new Date()
): CommunityEvent[] {
  return list
    .filter((e) => new Date(e.date).getTime() > now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function next(list: CommunityEvent[], now = new Date()): CommunityEvent {
  return upcoming(list, now)[0] ?? list[list.length - 1];
}

export async function getGallery(): Promise<GalleryItem[]> {
  if (!supabaseConfigured) return fallbackGallery;
  try {
    const { data, error } = await getSupabase()
      .from("gallery_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data || data.length === 0) return fallbackGallery;
    return data.map((row, i) => ({
      id: row.id,
      caption: row.caption || "",
      banglaCaption: row.title,
      palette: asPalette(row.palette, palettes[i % palettes.length]),
      tall: Boolean(row.tall),
      src: row.image_url || undefined,
    }));
  } catch {
    return fallbackGallery;
  }
}

export async function getCommittee(): Promise<CommitteeMember[]> {
  if (!supabaseConfigured) return fallbackCommittee;
  try {
    const { data, error } = await getSupabase()
      .from("committee_members")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return fallbackCommittee;
    return data.map((row, i) => ({
      name: row.name,
      role: row.role,
      initials: initialsOf(row.name),
      palette: palettes[i % palettes.length],
      photoUrl: row.photo_url || undefined,
    }));
  } catch {
    return fallbackCommittee;
  }
}
