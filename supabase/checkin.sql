-- Door check-in: who has been scanned in at the event, and by whom.
-- Run this once in the Supabase SQL editor AFTER payments.sql.

alter table public.registrations
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text not null default '';

create index if not exists registrations_checked_in_idx
  on public.registrations (checked_in_at);
