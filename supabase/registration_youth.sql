-- A third age band on a registration: 10 to 16 year olds.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
--
-- The picnic now charges by age rather than by role:
--   adults    16 and over
--   youth     10 to 16          <- this column
--   children  under 10, free
--
-- It is added with a default of 0, so every registration taken before today
-- keeps working and keeps the amount it was charged. Nobody is re-priced:
-- the adult price and the under-10 price are unchanged, this only adds a
-- band that did not exist.
--
-- The price itself needs no SQL. Settings fall back to the values in
-- lib/payments/defaults.ts when a row is missing, so price_youth works the
-- moment the code ships. Set it from /admin/payments if it should differ.

alter table public.registrations
  add column if not exists youth int not null default 0
    check (youth between 0 and 50);
