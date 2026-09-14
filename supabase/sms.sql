-- Text messages through Twilio: when each text went out, and why one did not.
-- Run this once in the Supabase SQL editor AFTER payments.sql.
--
-- The site works without this file. Until it is run, texts still send but the
-- result is not recorded, so the admin cannot show which member was texted.

alter table public.registrations
  add column if not exists code_sms_at timestamptz,
  add column if not exists ticket_sms_at timestamptz,
  add column if not exists sms_error text;

-- The switch the admin flips to start and stop texting, without a deploy.
insert into public.payment_settings (key, value)
  values ('sms_enabled', 'false')
  on conflict (key) do nothing;
