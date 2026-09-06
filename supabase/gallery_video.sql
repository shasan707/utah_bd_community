-- Gallery videos next to photos.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
--
-- A video tile is either a link (YouTube, Vimeo, Facebook) or a file uploaded
-- to the "photos" bucket (Supabase's free plan allows files up to 50 MB).
-- image_url becomes optional: for a video it is the cover picture, and when it
-- is empty a YouTube link supplies its own thumbnail.

alter table public.gallery_items
  add column if not exists media_type text not null default 'photo'
    check (media_type in ('photo', 'video')),
  add column if not exists video_url text;

alter table public.gallery_items alter column image_url drop not null;
