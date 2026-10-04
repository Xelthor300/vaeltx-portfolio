-- SMTP has no provider idempotency API. A persisted attempt with no receipt is
-- held for manual reconciliation instead of being sent again after lease expiry.
alter table public.va_outbox
  add column delivery_transport text check (delivery_transport in ('resend','smtp')),
  add column smtp_attempt_started_at timestamptz;
update public.va_outbox set delivery_transport='resend' where delivery_message is not null;
