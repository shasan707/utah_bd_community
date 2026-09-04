-- Email through the BPAU Gmail relay (EMAIL_PROVIDER=relay).
-- Run this once in the Supabase SQL editor AFTER payments.sql.
--
-- The website writes every email it wants to send here (the code email after
-- the form, the receipt after confirmation, alerts to the contact email). The
-- script in the BPAU Gmail account (apps-script/Zelle.gs, sendQueuedEmails)
-- picks them up about once a minute, sends them from that account with
-- MailApp exactly as the first version did, and reports back.

create table public.email_outbox (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  to_email text not null,
  subject text not null,
  body text not null,
  reply_to text not null default '',
  -- pending = code email, receipt = payment confirmed, admin = alert to the contact email
  kind text not null default 'other'
    check (kind in ('pending', 'receipt', 'admin', 'other')),
  -- the registration the email belongs to, so its row can be updated when sent
  code text,
  -- queued: waiting. sending: handed to the script (retried if no report in 15 min).
  -- sent: done. failed: gave up after repeated errors; the reason is in "error".
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  leased_at timestamptz,
  sent_at timestamptz,
  error text not null default ''
);

create index email_outbox_status_idx on public.email_outbox (status, created_at);
create index email_outbox_code_idx on public.email_outbox (code);

alter table public.email_outbox enable row level security;

-- Admins may look; only the server (service role) writes.
create policy "admin read email outbox" on public.email_outbox
  for select to authenticated using (true);
