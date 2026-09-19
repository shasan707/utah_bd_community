-- Test rows and Venmo. Run in the Supabase SQL editor BEFORE deploying the
-- code that uses them. Everything here is additive: no existing row changes,
-- no existing column changes, and the code running today never reads any of
-- it, so it can be run while members are registering.
--
-- Safe to run twice.

-- ---------------------------------------------------------------------------
-- Test rows: a rehearsal by an admin that must never be counted, listed or
-- admitted as if it were a member. Default false, so every row that exists
-- today is real without anyone touching it.
-- ---------------------------------------------------------------------------
alter table public.registrations
  add column if not exists is_test boolean not null default false;

alter table public.payments
  add column if not exists is_test boolean not null default false;

-- ---------------------------------------------------------------------------
-- Which service a payment came through. Everything recorded so far is Zelle,
-- which the default states rather than leaving null to be guessed at.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists provider text not null default 'zelle'
    check (provider in ('zelle', 'venmo'));

-- ---------------------------------------------------------------------------
-- Venmo. Blank means Venmo is offered nowhere on the site; the code ships
-- with it off and the admin turns it on from Settings when the rehearsal has
-- passed. Blanking the handle again turns it off.
-- ---------------------------------------------------------------------------
insert into public.payment_settings (key, value) values
  ('venmo_handle', ''),
  ('venmo_name', '')
on conflict (key) do nothing;
