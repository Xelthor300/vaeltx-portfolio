create table if not exists public.va_billing_customers (
  stripe_customer_id text primary key,
  email text,
  full_name text,
  business_name text,
  country text,
  locale text,
  last_checkout_session_id text,
  last_event_id text not null,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint va_billing_customers_email_len check (email is null or length(email) <= 254)
);

create table if not exists public.va_billing_subscriptions (
  stripe_subscription_id text primary key,
  stripe_customer_id text not null,
  stripe_checkout_session_id text,
  stripe_payment_link_id text,
  stripe_price_id text not null,
  plan_code text not null,
  currency text not null,
  unit_amount bigint not null,
  billing_interval text not null default 'month',
  stripe_status text not null,
  service_state text not null,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  latest_invoice_id text,
  livemode boolean not null,
  last_event_id text not null,
  last_event_type text not null,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint va_billing_subscriptions_customer_fk
    foreign key (stripe_customer_id) references public.va_billing_customers(stripe_customer_id) on update cascade on delete restrict,
  constraint va_billing_subscriptions_plan check (plan_code in ('hosting_care_us','hosting_care_mx')),
  constraint va_billing_subscriptions_currency check (currency in ('usd','mxn')),
  constraint va_billing_subscriptions_amount check (unit_amount > 0),
  constraint va_billing_subscriptions_interval check (billing_interval in ('month')),
  constraint va_billing_subscriptions_service_state check (service_state in ('pending','active','grace','suspended','ended','review'))
);

create index if not exists va_billing_subscriptions_customer_idx
  on public.va_billing_subscriptions(stripe_customer_id);
create index if not exists va_billing_subscriptions_service_idx
  on public.va_billing_subscriptions(service_state, updated_at desc);

create table if not exists public.va_billing_invoices (
  stripe_invoice_id text primary key,
  stripe_subscription_id text,
  stripe_customer_id text,
  invoice_number text,
  billing_reason text,
  stripe_status text,
  currency text,
  amount_due bigint not null default 0,
  amount_paid bigint not null default 0,
  amount_remaining bigint not null default 0,
  attempt_count integer not null default 0,
  next_payment_attempt timestamptz,
  paid_at timestamptz,
  livemode boolean not null,
  last_event_id text not null,
  last_event_type text not null,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint va_billing_invoices_amounts check (amount_due >= 0 and amount_paid >= 0 and amount_remaining >= 0),
  constraint va_billing_invoices_attempts check (attempt_count >= 0)
);

create index if not exists va_billing_invoices_subscription_idx
  on public.va_billing_invoices(stripe_subscription_id);
create index if not exists va_billing_invoices_customer_idx
  on public.va_billing_invoices(stripe_customer_id);
create index if not exists va_billing_invoices_status_idx
  on public.va_billing_invoices(stripe_status, updated_at desc);

create table if not exists public.va_billing_events (
  stripe_event_id text primary key,
  event_type text not null,
  object_id text,
  payload_sha256 text not null,
  api_version text,
  livemode boolean not null,
  stripe_created_at timestamptz not null,
  processed_at timestamptz not null default now(),
  constraint va_billing_events_hash check (payload_sha256 ~ '^[0-9a-f]{64}$')
);

create index if not exists va_billing_events_created_idx
  on public.va_billing_events(stripe_created_at desc);
create index if not exists va_billing_events_type_idx
  on public.va_billing_events(event_type, stripe_created_at desc);

alter table public.va_billing_customers enable row level security;
alter table public.va_billing_subscriptions enable row level security;
alter table public.va_billing_invoices enable row level security;
alter table public.va_billing_events enable row level security;

revoke all on public.va_billing_customers from anon, authenticated;
revoke all on public.va_billing_subscriptions from anon, authenticated;
revoke all on public.va_billing_invoices from anon, authenticated;
revoke all on public.va_billing_events from anon, authenticated;

create or replace function public.va_billing_apply_event(
  p_event_id text,
  p_event_type text,
  p_object_id text,
  p_event_created_at timestamptz,
  p_api_version text,
  p_livemode boolean,
  p_payload_sha256 text,
  p_customer jsonb default null,
  p_subscription jsonb default null,
  p_invoice jsonb default null,
  p_notification jsonb default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_hash text;
  v_kind text;
  v_payload jsonb;
begin
  select payload_sha256 into v_existing_hash
  from public.va_billing_events
  where stripe_event_id = p_event_id;

  if v_existing_hash is not null then
    if v_existing_hash <> p_payload_sha256 then
      raise exception 'stripe_event_payload_mismatch';
    end if;
    return 'duplicate';
  end if;

  if p_customer is not null then
    insert into public.va_billing_customers(
      stripe_customer_id,email,full_name,business_name,country,locale,
      last_checkout_session_id,last_event_id,last_event_created_at,updated_at
    ) values (
      p_customer->>'stripe_customer_id',
      nullif(p_customer->>'email',''),
      nullif(p_customer->>'full_name',''),
      nullif(p_customer->>'business_name',''),
      nullif(p_customer->>'country',''),
      nullif(p_customer->>'locale',''),
      nullif(p_customer->>'last_checkout_session_id',''),
      p_event_id,p_event_created_at,clock_timestamp()
    )
    on conflict (stripe_customer_id) do update set
      email = coalesce(excluded.email, va_billing_customers.email),
      full_name = coalesce(excluded.full_name, va_billing_customers.full_name),
      business_name = coalesce(excluded.business_name, va_billing_customers.business_name),
      country = coalesce(excluded.country, va_billing_customers.country),
      locale = coalesce(excluded.locale, va_billing_customers.locale),
      last_checkout_session_id = coalesce(excluded.last_checkout_session_id, va_billing_customers.last_checkout_session_id),
      last_event_id = excluded.last_event_id,
      last_event_created_at = excluded.last_event_created_at,
      updated_at = clock_timestamp()
    where excluded.last_event_created_at >= va_billing_customers.last_event_created_at;
  end if;

  if p_subscription is not null then
    insert into public.va_billing_customers(
      stripe_customer_id,last_event_id,last_event_created_at,updated_at
    ) values (
      p_subscription->>'stripe_customer_id',p_event_id,p_event_created_at,clock_timestamp()
    )
    on conflict (stripe_customer_id) do update set
      last_event_id = excluded.last_event_id,
      last_event_created_at = excluded.last_event_created_at,
      updated_at = clock_timestamp()
    where excluded.last_event_created_at >= va_billing_customers.last_event_created_at;

    insert into public.va_billing_subscriptions(
      stripe_subscription_id,stripe_customer_id,stripe_checkout_session_id,stripe_payment_link_id,
      stripe_price_id,plan_code,currency,unit_amount,billing_interval,stripe_status,service_state,
      cancel_at_period_end,current_period_start,current_period_end,cancel_at,canceled_at,ended_at,
      latest_invoice_id,livemode,last_event_id,last_event_type,last_event_created_at,updated_at
    ) values (
      p_subscription->>'stripe_subscription_id',
      p_subscription->>'stripe_customer_id',
      nullif(p_subscription->>'stripe_checkout_session_id',''),
      nullif(p_subscription->>'stripe_payment_link_id',''),
      p_subscription->>'stripe_price_id',
      p_subscription->>'plan_code',
      lower(p_subscription->>'currency'),
      (p_subscription->>'unit_amount')::bigint,
      coalesce(nullif(p_subscription->>'billing_interval',''),'month'),
      p_subscription->>'stripe_status',
      p_subscription->>'service_state',
      coalesce((p_subscription->>'cancel_at_period_end')::boolean,false),
      nullif(p_subscription->>'current_period_start','')::timestamptz,
      nullif(p_subscription->>'current_period_end','')::timestamptz,
      nullif(p_subscription->>'cancel_at','')::timestamptz,
      nullif(p_subscription->>'canceled_at','')::timestamptz,
      nullif(p_subscription->>'ended_at','')::timestamptz,
      nullif(p_subscription->>'latest_invoice_id',''),
      p_livemode,p_event_id,p_event_type,p_event_created_at,clock_timestamp()
    )
    on conflict (stripe_subscription_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, va_billing_subscriptions.stripe_checkout_session_id),
      stripe_payment_link_id = coalesce(excluded.stripe_payment_link_id, va_billing_subscriptions.stripe_payment_link_id),
      stripe_price_id = excluded.stripe_price_id,
      plan_code = excluded.plan_code,
      currency = excluded.currency,
      unit_amount = excluded.unit_amount,
      billing_interval = excluded.billing_interval,
      stripe_status = excluded.stripe_status,
      service_state = excluded.service_state,
      cancel_at_period_end = excluded.cancel_at_period_end,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at = excluded.cancel_at,
      canceled_at = excluded.canceled_at,
      ended_at = excluded.ended_at,
      latest_invoice_id = excluded.latest_invoice_id,
      livemode = excluded.livemode,
      last_event_id = excluded.last_event_id,
      last_event_type = excluded.last_event_type,
      last_event_created_at = excluded.last_event_created_at,
      updated_at = clock_timestamp()
    where excluded.last_event_created_at >= va_billing_subscriptions.last_event_created_at;
  end if;

  if p_invoice is not null then
    insert into public.va_billing_invoices(
      stripe_invoice_id,stripe_subscription_id,stripe_customer_id,invoice_number,billing_reason,
      stripe_status,currency,amount_due,amount_paid,amount_remaining,attempt_count,
      next_payment_attempt,paid_at,livemode,last_event_id,last_event_type,last_event_created_at,updated_at
    ) values (
      p_invoice->>'stripe_invoice_id',
      nullif(p_invoice->>'stripe_subscription_id',''),
      nullif(p_invoice->>'stripe_customer_id',''),
      nullif(p_invoice->>'invoice_number',''),
      nullif(p_invoice->>'billing_reason',''),
      nullif(p_invoice->>'stripe_status',''),
      lower(nullif(p_invoice->>'currency','')),
      coalesce((p_invoice->>'amount_due')::bigint,0),
      coalesce((p_invoice->>'amount_paid')::bigint,0),
      coalesce((p_invoice->>'amount_remaining')::bigint,0),
      coalesce((p_invoice->>'attempt_count')::integer,0),
      nullif(p_invoice->>'next_payment_attempt','')::timestamptz,
      nullif(p_invoice->>'paid_at','')::timestamptz,
      p_livemode,p_event_id,p_event_type,p_event_created_at,clock_timestamp()
    )
    on conflict (stripe_invoice_id) do update set
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, va_billing_invoices.stripe_subscription_id),
      stripe_customer_id = coalesce(excluded.stripe_customer_id, va_billing_invoices.stripe_customer_id),
      invoice_number = coalesce(excluded.invoice_number, va_billing_invoices.invoice_number),
      billing_reason = coalesce(excluded.billing_reason, va_billing_invoices.billing_reason),
      stripe_status = excluded.stripe_status,
      currency = coalesce(excluded.currency, va_billing_invoices.currency),
      amount_due = excluded.amount_due,
      amount_paid = excluded.amount_paid,
      amount_remaining = excluded.amount_remaining,
      attempt_count = excluded.attempt_count,
      next_payment_attempt = excluded.next_payment_attempt,
      paid_at = excluded.paid_at,
      livemode = excluded.livemode,
      last_event_id = excluded.last_event_id,
      last_event_type = excluded.last_event_type,
      last_event_created_at = excluded.last_event_created_at,
      updated_at = clock_timestamp()
    where excluded.last_event_created_at >= va_billing_invoices.last_event_created_at;
  end if;

  if p_notification is not null then
    v_kind := p_notification->>'kind';
    v_payload := p_notification - 'kind';
    if v_kind is null or v_kind !~ '^billing_[a-z_]+$' then
      raise exception 'invalid_billing_notification_kind';
    end if;
    insert into public.va_outbox(dedupe_key,kind,audience,participant_id,payload)
    values ('billing:'||p_event_id,v_kind,'owner',null,v_payload)
    on conflict (dedupe_key) do nothing;
  end if;

  insert into public.va_billing_events(
    stripe_event_id,event_type,object_id,payload_sha256,api_version,livemode,stripe_created_at
  ) values (
    p_event_id,p_event_type,p_object_id,p_payload_sha256,nullif(p_api_version,''),p_livemode,p_event_created_at
  );

  return 'processed';
end;
$$;

revoke all on function public.va_billing_apply_event(text,text,text,timestamptz,text,boolean,text,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.va_billing_apply_event(text,text,text,timestamptz,text,boolean,text,jsonb,jsonb,jsonb,jsonb) to service_role;
