-- Records that a registration's raffle coupons were handed over at the desk.
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Entry already has a stamp of its own, checked_in_at. Coupons had none, so
-- nothing stopped the same code collecting twice, and nothing could say how
-- many had gone out. These two columns are the coupon equivalent: when, and
-- which volunteer. Both stay null until the coupons are actually handed over.
--
-- Nothing existing changes. Every row simply reads as "not collected yet".

alter table public.registrations
  add column if not exists coupons_collected_at timestamptz;

alter table public.registrations
  add column if not exists coupons_collected_by text not null default '';
