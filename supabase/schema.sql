-- Utha USA admin schema
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
-- Prerequisite: create a PUBLIC storage bucket named "photos" first (Storage -> New bucket).

-- Gallery photos shown on the Gallery page
create table public.gallery_items (
  id bigint generated always as identity primary key,
  title text not null,
  caption text,
  image_url text not null,
  palette text not null default 'green',
  tall boolean not null default false,
  created_at timestamptz not null default now()
);

-- Community events shown on the Events pages and home page
create table public.events (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  short_name text,
  date timestamptz not null,
  end_time text,
  venue text,
  city text not null default 'Salt Lake City, UT',
  tag text,
  free boolean not null default true,
  blurb text,
  description jsonb not null default '[]'::jsonb,
  palette text not null default 'green',
  image_url text,
  created_at timestamptz not null default now()
);

-- Committee members shown on the About page
create table public.committee_members (
  id bigint generated always as identity primary key,
  name text not null,
  role text not null,
  photo_url text,
  sort_order int not null default 0
);

-- Security: everyone can read, only the logged-in admin can write
alter table public.gallery_items enable row level security;
alter table public.events enable row level security;
alter table public.committee_members enable row level security;

create policy "public read gallery" on public.gallery_items
  for select using (true);
create policy "admin write gallery" on public.gallery_items
  for all to authenticated using (true) with check (true);

create policy "public read events" on public.events
  for select using (true);
create policy "admin write events" on public.events
  for all to authenticated using (true) with check (true);

create policy "public read committee" on public.committee_members
  for select using (true);
create policy "admin write committee" on public.committee_members
  for all to authenticated using (true) with check (true);

-- Storage: everyone can view photos, only the logged-in admin can upload/change them
create policy "public read photos" on storage.objects
  for select using (bucket_id = 'photos');
create policy "admin insert photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "admin update photos" on storage.objects
  for update to authenticated using (bucket_id = 'photos');
create policy "admin delete photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');
