-- Blog posts shown at /blog and managed at /admin/blog.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.

create table public.posts (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  -- Simple markdown: # headings, paragraphs, **bold**, *italic*, [links](url),
  -- ![images](url), - lists, 1. lists, > quotes, --- rules.
  body text not null default '',
  author text not null default 'Utah USA',
  tag text,
  palette text not null default 'green',
  cover_url text,
  published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_published_idx on public.posts (published, published_at desc);

alter table public.posts enable row level security;

-- Everyone can read published posts; signed-in admins see drafts too and can write.
create policy "public read published posts" on public.posts
  for select using (published = true);
create policy "admin read posts" on public.posts
  for select to authenticated using (true);
create policy "admin write posts" on public.posts
  for all to authenticated using (true) with check (true);
