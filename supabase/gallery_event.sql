-- Tie a gallery photo or video to one event.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
--
-- event_slug matches events.slug. It stays empty for a general community
-- picture, and a general picture shows on every event page. An event page
-- prefers its own tagged pictures and falls back to the general mix when it
-- has none of its own yet, so the strip is never empty.

alter table public.gallery_items
  add column if not exists event_slug text;

create index if not exists gallery_items_event_slug_idx
  on public.gallery_items (event_slug);
