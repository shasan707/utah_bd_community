-- Automatic Zelle confirmation: bank alert emails relayed from the BPAU Gmail.
-- Run this once in the Supabase SQL editor AFTER payments.sql.

-- Every relayed email, so the same message is never processed twice and the
-- admin can see when the last bank alert arrived.
create table public.raw_emails (
  message_id text primary key,
  received_at timestamptz not null,
  subject text not null default '',
  body_plain text not null default '',
  parsed boolean not null default false,
  created_at timestamptz not null default now()
);

create index raw_emails_received_idx on public.raw_emails (received_at desc);

alter table public.raw_emails enable row level security;

create policy "admin read raw emails" on public.raw_emails
  for select to authenticated using (true);

-- Link each recorded payment back to the email it came from (null when the
-- treasurer typed it in by hand).
alter table public.payments
  add column if not exists message_id text references public.raw_emails (message_id);
