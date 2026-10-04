alter table public.va_participants add column email_verified_at timestamptz;
update public.va_participants p set email_verified_at=u.email_confirmed_at from auth.users u where p.id=u.id;
