-- Utha USA payment system schema (registration codes, Zelle payments, audit log)
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
-- Prerequisite: schema.sql has already been run (it sets up the content tables).
--
-- Security model:
--   * Signed-in admins can read every table and edit payment_settings from the browser.
--   * Nobody can write registrations, payments, or audit_log from the browser.
--     Those writes happen only in Next.js route handlers using the service role key,
--     so every money change goes through code that also writes the audit log.
--   * The anon key has no policy at all on these tables, so the public cannot read them.

-- Key/value settings, the replacement for the old Pricing tab
create table public.payment_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (key, value) values
  ('event_name', 'BPAU Eid Reunion 2026'),
  ('event_date', '2026-10-18'),
  ('registration_closes', '2026-10-11'),
  ('registration_open', 'false'),
  ('price_adult', '25'),
  ('price_child', '10'),
  ('price_student', '15'),
  ('coupon_single', '2'),
  ('coupon_bundle_qty', '10'),
  ('coupon_bundle_price', '18'),
  ('zelle_recipient', ''),
  ('zelle_recipient_name', ''),
  ('contact_email', ''),
  ('pending_expiry_hours', '72'),
  ('auto_confirm', 'false');

-- One row per payment code
create table public.registrations (
  code text primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  adults int not null default 0 check (adults between 0 and 50),
  children int not null default 0 check (children between 0 and 50),
  ticket_type text not null default 'professional'
    check (ticket_type in ('professional', 'student')),
  coupons_qty int not null default 0 check (coupons_qty between 0 and 500),
  donation numeric(10,2) not null default 0 check (donation >= 0),
  comment text not null default '',
  amount_due numeric(10,2) not null check (amount_due >= 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED')),
  payment_method text
    check (payment_method in ('zelle', 'cash', 'venmo', 'check', 'comp')),
  amount_received numeric(10,2),
  paid_at timestamptz,
  zelle_confirmation_id text,
  zelle_sender_name text,
  receipt_sent_at timestamptz,
  pending_email_sent_at timestamptz,
  email_error text,
  created_by text not null default 'web',
  announcements_opt_in boolean not null default false,
  notes text not null default '',
  client_ip text
);

create index registrations_status_created_idx
  on public.registrations (status, created_at);
create index registrations_email_created_idx
  on public.registrations (email, created_at desc);
create index registrations_ip_created_idx
  on public.registrations (client_ip, created_at desc);

-- Zelle transactions as seen by the treasurer (recorded by hand today,
-- by an inbound email webhook later). Not used by the first version of the admin UI.
create table public.payments (
  id bigint generated always as identity primary key,
  confirmation_id text not null,
  received_at timestamptz not null,
  sender_name text not null default '',
  amount numeric(10,2) not null check (amount >= 0),
  memo_raw text not null default '',
  memo_normalized text not null default '',
  extracted_code text not null default '',
  match_status text not null default 'UNMATCHED'
    check (match_status in ('UNMATCHED', 'MATCHED', 'AMOUNT_MISMATCH', 'DUPLICATE')),
  linked_code text references public.registrations (code),
  suggested_code text,
  processed_at timestamptz,
  source text not null default 'admin' check (source in ('admin', 'email', 'import')),
  created_at timestamptz not null default now()
);

create unique index payments_confirmation_unique
  on public.payments (confirmation_id) where match_status <> 'DUPLICATE';
create index payments_status_idx on public.payments (match_status, processed_at);

-- Every change to money is written here
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null default 'system',
  action text not null,
  entity_code text,
  before jsonb,
  after jsonb,
  note text not null default ''
);

create index audit_log_entity_idx on public.audit_log (entity_code, at desc);
create index audit_log_at_idx on public.audit_log (at desc);

alter table public.payment_settings enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;
alter table public.audit_log enable row level security;

create policy "admin read settings" on public.payment_settings
  for select to authenticated using (true);
create policy "admin update settings" on public.payment_settings
  for update to authenticated using (true) with check (true);
create policy "admin insert settings" on public.payment_settings
  for insert to authenticated with check (true);

create policy "admin read registrations" on public.registrations
  for select to authenticated using (true);
create policy "admin read payments" on public.payments
  for select to authenticated using (true);
create policy "admin read audit" on public.audit_log
  for select to authenticated using (true);
