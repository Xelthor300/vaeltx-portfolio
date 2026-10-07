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
  v_inserted integer := 0;
  v_existing_at timestamptz;
  v_notify boolean := true;
begin
  if p_event_id is null or length(p_event_id) > 255 then
    raise exception 'invalid_stripe_event_id';
  end if;
  if p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_stripe_payload_hash';
  end if;

  insert into public.va_billing_events(
    stripe_event_id,event_type,object_id,payload_sha256,api_version,livemode,stripe_created_at
  ) values (
    p_event_id,p_event_type,p_object_id,p_payload_sha256,nullif(p_api_version,''),p_livemode,p_event_created_at
  )
  on conflict (stripe_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select payload_sha256 into v_existing_hash
    from public.va_billing_events
    where stripe_event_id = p_event_id;
    if v_existing_hash is distinct from p_payload_sha256 then
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
      email = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then coalesce(excluded.email, va_billing_customers.email)
        else coalesce(va_billing_customers.email, excluded.email) end,
      full_name = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then coalesce(excluded.full_name, va_billing_customers.full_name)
        else coalesce(va_billing_customers.full_name, excluded.full_name) end,
      business_name = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then coalesce(excluded.business_name, va_billing_customers.business_name)
        else coalesce(va_billing_customers.business_name, excluded.business_name) end,
      country = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then coalesce(excluded.country, va_billing_customers.country)
        else coalesce(va_billing_customers.country, excluded.country) end,
      locale = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then coalesce(excluded.locale, va_billing_customers.locale)
        else coalesce(va_billing_customers.locale, excluded.locale) end,
      last_checkout_session_id = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then coalesce(excluded.last_checkout_session_id, va_billing_customers.last_checkout_session_id)
        else coalesce(va_billing_customers.last_checkout_session_id, excluded.last_checkout_session_id) end,
      last_event_id = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then excluded.last_event_id else va_billing_customers.last_event_id end,
      last_event_created_at = greatest(excluded.last_event_created_at, va_billing_customers.last_event_created_at),
      updated_at = clock_timestamp();
  end if;

  if p_subscription is not null then
    select last_event_created_at into v_existing_at
    from public.va_billing_subscriptions
    where stripe_subscription_id = p_subscription->>'stripe_subscription_id';
    if v_existing_at is not null and p_event_created_at < v_existing_at then
      v_notify := false;
    end if;

    insert into public.va_billing_customers(
      stripe_customer_id,last_event_id,last_event_created_at,updated_at
    ) values (
      p_subscription->>'stripe_customer_id',p_event_id,p_event_created_at,clock_timestamp()
    )
    on conflict (stripe_customer_id) do update set
      last_event_id = case when excluded.last_event_created_at >= va_billing_customers.last_event_created_at
        then excluded.last_event_id else va_billing_customers.last_event_id end,
      last_event_created_at = greatest(excluded.last_event_created_at, va_billing_customers.last_event_created_at),
      updated_at = clock_timestamp();

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
    select last_event_created_at into v_existing_at
    from public.va_billing_invoices
    where stripe_invoice_id = p_invoice->>'stripe_invoice_id';
    if v_existing_at is not null and p_event_created_at < v_existing_at then
      v_notify := false;
    end if;

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

  if p_notification is not null and v_notify then
    v_kind := p_notification->>'kind';
    v_payload := p_notification - 'kind';
    if v_kind is null or v_kind !~ '^billing_[a-z_]+$' then
      raise exception 'invalid_billing_notification_kind';
    end if;
    insert into public.va_outbox(dedupe_key,kind,audience,participant_id,payload)
    values ('billing:'||p_event_id,v_kind,'owner',null,v_payload)
    on conflict (dedupe_key) do nothing;
  end if;

  return 'processed';
end;
$$;

revoke all on function public.va_billing_apply_event(text,text,text,timestamptz,text,boolean,text,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.va_billing_apply_event(text,text,text,timestamptz,text,boolean,text,jsonb,jsonb,jsonb,jsonb) to service_role;
