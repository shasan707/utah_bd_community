-- Ticket-style emails: the outbox carries an HTML version next to the text.
-- Run this once in the Supabase SQL editor AFTER payments_email.sql.

alter table public.email_outbox add column if not exists html text;
