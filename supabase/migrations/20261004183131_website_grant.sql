-- Isolated campaign tables. No production start date, entrants or payments are seeded.
create function public.wg_rules_complete(rules jsonb) returns boolean language sql immutable set search_path = '' as $$
  select count(*) = 25 from generate_series(1,25) n where length(trim(rules ->> n::text)) >= 10;
$$;
create table public.wg_campaigns (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name text not null, status text not null default 'draft' check (status in ('draft','scheduled','active','closed','selection_pending','selected','completed','cancelled')),
  start_at timestamptz, end_at timestamptz, prize_quantity integer not null default 1 check (prize_quantity = 1),
  eligible_countries text[] not null default '{}', minimum_age integer not null default 18 check (minimum_age >= 18),
  rules_version text, rules jsonb not null default '{}', legal_approved_at timestamptz,
  sponsor_details text, prize_arv_minor integer check (prize_arv_minor > 0), prize_arv_currency text not null default 'USD' check (prize_arv_currency in ('USD','CAD','MXN')),
  selection_mode text not null default 'random' check (selection_mode in ('random','judged')), selection_procedure text,
  paid_entries_enabled boolean not null default false, processor_approved_at timestamptz, services_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at),
  check (status not in ('scheduled','active') or (start_at is not null and end_at is not null and legal_approved_at is not null and rules_version is not null and sponsor_details is not null and prize_arv_minor is not null and cardinality(eligible_countries) > 0 and selection_procedure is not null and public.wg_rules_complete(rules))),
  check (not paid_entries_enabled or (legal_approved_at is not null and processor_approved_at is not null))
);

create table public.wg_participants (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.wg_campaigns,
  auth_user_id uuid not null references auth.users on delete restrict, email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  application jsonb not null, rules_version text not null, verified_at timestamptz not null default now(),
  age_confirmed_at timestamptz not null default now(), terms_accepted_at timestamptz not null default now(), campaign_contact_consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(), unique(campaign_id,auth_user_id), unique(campaign_id,email_normalized)
);
create table public.wg_catalog (
  code text not null, kind text not null check (kind in ('entries','service')), quantity integer not null,
  currency text not null check (currency in ('USD','CAD','MXN')), amount_minor integer not null check (amount_minor > 0),
  primary key(code,currency), check ((kind='entries' and quantity between 5 and 100 and quantity % 5=0) or (kind='service' and quantity=1))
);
insert into public.wg_catalog
select 'entries-' || q, 'entries', q, c, base * (q/5) from generate_series(5,100,5) q cross join (values ('USD',600),('CAD',847),('MXN',10887)) p(c,base);
insert into public.wg_catalog values
('homepage-review','service',1,'USD',900),('homepage-review','service',1,'CAD',1200),('homepage-review','service',1,'MXN',18000),
('strategy-audit','service',1,'USD',1900),('strategy-audit','service',1,'CAD',2600),('strategy-audit','service',1,'MXN',38000),
('ux-action-plan','service',1,'USD',3900),('ux-action-plan','service',1,'CAD',5300),('ux-action-plan','service',1,'MXN',78000);

create table public.wg_orders (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.wg_participants,
  campaign_id uuid not null references public.wg_campaigns, request_id uuid not null, kind text not null check (kind in ('entries','service')),
  code text not null, quantity integer not null, currency text not null, amount_minor integer not null check (amount_minor > 0),
  status text not null default 'pending' check (status in ('pending','paid','expired','failed','review','refunded','disputed')),
  stripe_session_id text unique, stripe_payment_intent_id text unique, paid_at timestamptz, created_at timestamptz not null default now(),
  unique(participant_id,request_id), foreign key(code,currency) references public.wg_catalog(code,currency)
);
create table public.wg_entries (
  id bigint generated always as identity primary key, campaign_id uuid not null references public.wg_campaigns,
  participant_id uuid not null references public.wg_participants, order_id uuid references public.wg_orders,
  entry_number text unique not null, entry_source text not null check (entry_source in ('free_verified','paid')),
  status text not null default 'valid' check (status in ('valid','invalid','review')),
  created_at timestamptz not null default now(), check ((entry_source='free_verified' and order_id is null) or (entry_source='paid' and order_id is not null))
);
create unique index wg_one_free_entry on public.wg_entries(campaign_id,participant_id) where entry_source='free_verified';
create index wg_valid_entries on public.wg_entries(campaign_id,status);
create index wg_participant_entries on public.wg_entries(participant_id,id);
create function public.wg_entry_number() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='INSERT' then new.entry_number := 'VAELTX-' || extract(year from new.created_at)::text || '-' || lpad(new.id::text, greatest(6,length(new.id::text)), '0');
  elsif new.id <> old.id or new.entry_number <> old.entry_number or new.participant_id <> old.participant_id or new.campaign_id <> old.campaign_id or new.entry_source <> old.entry_source or new.order_id is distinct from old.order_id then
    raise exception 'Entry identity is immutable';
  end if;
  return new;
end; $$;
create trigger wg_entry_identity before insert or update on public.wg_entries for each row execute function public.wg_entry_number();

create table public.wg_payment_events (event_id text primary key, order_id uuid references public.wg_orders, event_type text not null, created_at timestamptz not null default now());
create table public.wg_audit_logs (id bigint generated always as identity primary key, campaign_id uuid references public.wg_campaigns, action text not null, subject_id text, created_at timestamptz not null default now());
create table public.wg_email_outbox (
  id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.wg_participants,
  kind text not null check (kind in ('free-entry','purchase')), subject_id text not null, sent_at timestamptz, provider_id text,
  created_at timestamptz not null default now(), unique(kind,subject_id)
);
create table public.wg_rate_limits (key text primary key, hits integer not null, window_start timestamptz not null);
create table public.wg_winner_selections (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.wg_campaigns,
  entry_id bigint not null references public.wg_entries, eligible_pool_count bigint not null, pool_digest text not null, algorithm_version text not null,
  selected_at timestamptz not null default now(), accepted_at timestamptz
);

-- Database-backed limiter shared across Vercel instances. Keys are HMACs, never raw IPs/emails.
create function public.wg_take_rate_limit(p_key text, p_limit integer, p_window_seconds integer) returns boolean language plpgsql set search_path='' as $$
declare bucket public.wg_rate_limits;
begin
  delete from public.wg_rate_limits where window_start < now() - interval '1 day';
  insert into public.wg_rate_limits values (p_key,1,now()) on conflict(key) do update set
    hits=case when wg_rate_limits.window_start < now()-make_interval(secs=>p_window_seconds) then 1 else wg_rate_limits.hits+1 end,
    window_start=case when wg_rate_limits.window_start < now()-make_interval(secs=>p_window_seconds) then now() else wg_rate_limits.window_start end returning * into bucket;
  return bucket.hits <= p_limit;
end; $$;

create function public.wg_claim_free(p_campaign uuid, p_user uuid, p_email text, p_application jsonb) returns jsonb language plpgsql set search_path='' as $$
declare c public.wg_campaigns; participant public.wg_participants; ticket public.wg_entries; duplicate boolean;
begin
  select * into c from public.wg_campaigns where id=p_campaign for share;
  if c.id is null or c.status <> 'active' or c.start_at > now() or c.end_at <= now() or c.legal_approved_at is null then raise exception 'CAMPAIGN_CLOSED'; end if;
  if not (p_application->>'country' = any(c.eligible_countries)) then raise exception 'NOT_ELIGIBLE'; end if;
  if not (p_application @> '{"age_confirmed":true,"rules_accepted":true,"contact_consent":true}'::jsonb) then raise exception 'CONSENT_REQUIRED'; end if;
  insert into public.wg_participants(campaign_id,auth_user_id,email_normalized,application,rules_version)
    values(p_campaign,p_user,lower(trim(p_email)),p_application,c.rules_version) on conflict(campaign_id,auth_user_id) do nothing;
  select * into participant from public.wg_participants where campaign_id=p_campaign and auth_user_id=p_user for update;
  select * into ticket from public.wg_entries where campaign_id=p_campaign and participant_id=participant.id and entry_source='free_verified';
  duplicate := ticket.id is not null;
  if not duplicate then
    insert into public.wg_entries(campaign_id,participant_id,entry_source) values(p_campaign,participant.id,'free_verified') returning * into ticket;
    insert into public.wg_email_outbox(participant_id,kind,subject_id) values(participant.id,'free-entry',ticket.entry_number);
  end if;
  insert into public.wg_audit_logs(campaign_id,action,subject_id) values(p_campaign,case when duplicate then 'duplicate_free_reused' else 'free_entry_confirmed' end,ticket.entry_number);
  return jsonb_build_object('entry_number',ticket.entry_number,'already_exists',duplicate);
end; $$;

create function public.wg_create_order(p_campaign uuid,p_user uuid,p_kind text,p_code text,p_currency text,p_quantity integer,p_request uuid) returns jsonb language plpgsql set search_path='' as $$
declare c public.wg_campaigns; participant public.wg_participants; price public.wg_catalog; purchase public.wg_orders;
begin
  select * into c from public.wg_campaigns where id=p_campaign for share;
  select * into participant from public.wg_participants where campaign_id=p_campaign and auth_user_id=p_user;
  if participant.id is null then raise exception 'APPLICATION_REQUIRED'; end if;
  if c.legal_approved_at is null or c.status <> 'active' or c.start_at > now() or c.end_at <= now() then raise exception 'CAMPAIGN_CLOSED'; end if;
  if p_kind='entries' and (not c.paid_entries_enabled or c.processor_approved_at is null) then raise exception 'PAID_ENTRIES_BLOCKED'; end if;
  if p_kind='service' and not c.services_enabled then raise exception 'SERVICES_BLOCKED'; end if;
  select * into price from public.wg_catalog where code=p_code and currency=p_currency and kind=p_kind and quantity=p_quantity;
  if price.code is null then raise exception 'INVALID_PRICE'; end if;
  insert into public.wg_orders(participant_id,campaign_id,request_id,kind,code,quantity,currency,amount_minor)
    values(participant.id,p_campaign,p_request,p_kind,price.code,price.quantity,price.currency,price.amount_minor) on conflict(participant_id,request_id) do nothing;
  select * into purchase from public.wg_orders where participant_id=participant.id and request_id=p_request;
  if purchase.code<>p_code or purchase.currency<>p_currency or purchase.quantity<>p_quantity or purchase.kind<>p_kind then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return to_jsonb(purchase);
end; $$;

-- Only called after server verification of Stripe signature, account, mode and session ownership.
create function public.wg_fulfill_payment(p_event text,p_type text,p_order uuid,p_session text,p_intent text,p_amount integer,p_currency text,p_paid_at timestamptz) returns text language plpgsql set search_path='' as $$
declare purchase public.wg_orders; c public.wg_campaigns;
begin
  select * into purchase from public.wg_orders where id=p_order for update;
  if purchase.id is null or purchase.stripe_session_id is distinct from p_session or purchase.amount_minor<>p_amount or lower(purchase.currency)<>lower(p_currency) then raise exception 'PAYMENT_MISMATCH'; end if;
  insert into public.wg_payment_events(event_id,order_id,event_type) values(p_event,p_order,p_type) on conflict do nothing;
  if not found or purchase.status='paid' then return 'duplicate'; end if;
  if purchase.status in ('refunded','disputed','review') then return 'review'; end if;
  select * into c from public.wg_campaigns where id=purchase.campaign_id for share;
  if purchase.kind='entries' and (not c.paid_entries_enabled or c.processor_approved_at is null or c.status<>'active' or p_paid_at < c.start_at or p_paid_at >= c.end_at or now() >= c.end_at) then
    update public.wg_orders set status='review',stripe_payment_intent_id=p_intent where id=p_order;
    insert into public.wg_audit_logs(campaign_id,action,subject_id) values(c.id,'late_or_blocked_payment_review',p_order::text);
    return 'review';
  end if;
  update public.wg_orders set status='paid',paid_at=p_paid_at,stripe_payment_intent_id=p_intent where id=p_order;
  if purchase.kind='entries' then
    insert into public.wg_entries(campaign_id,participant_id,order_id,entry_source)
      select purchase.campaign_id,purchase.participant_id,p_order,'paid' from generate_series(1,purchase.quantity);
  end if;
  insert into public.wg_email_outbox(participant_id,kind,subject_id) values(purchase.participant_id,'purchase',p_order::text) on conflict do nothing;
  insert into public.wg_audit_logs(campaign_id,action,subject_id) values(c.id,'payment_confirmed',p_order::text);
  return 'paid';
end; $$;

create function public.wg_reverse_payment(p_event text,p_type text,p_intent text,p_status text) returns text language plpgsql set search_path='' as $$
declare purchase public.wg_orders;
begin
  if p_status not in ('refunded','disputed','review') then raise exception 'INVALID_STATUS'; end if;
  select * into purchase from public.wg_orders where stripe_payment_intent_id=p_intent for update;
  if purchase.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into public.wg_payment_events(event_id,order_id,event_type) values(p_event,purchase.id,p_type) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  update public.wg_orders set status=p_status where id=purchase.id;
  update public.wg_entries set status=case when p_status='refunded' then 'invalid' else 'review' end where order_id=purchase.id;
  insert into public.wg_audit_logs(campaign_id,action,subject_id) values(purchase.campaign_id,p_status,purchase.id::text);
  return p_status;
end; $$;

create function public.wg_public_count(p_campaign uuid) returns bigint language sql stable set search_path='' as $$
  select count(*) from public.wg_entries where campaign_id=p_campaign and status='valid';
$$;

-- No browser role can read tables or execute mutations; routes explicitly check verified ownership.
do $$ declare item text; routine record; begin
  foreach item in array array['wg_campaigns','wg_participants','wg_catalog','wg_orders','wg_entries','wg_payment_events','wg_audit_logs','wg_email_outbox','wg_rate_limits','wg_winner_selections'] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('revoke all on public.%I from public,anon,authenticated',item);
    execute format('grant all on public.%I to service_role',item);
  end loop;
  for routine in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'wg_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',routine.signature);
    execute format('grant execute on function %s to service_role',routine.signature);
  end loop;
end $$;
grant usage,select on sequence public.wg_entries_id_seq,public.wg_audit_logs_id_seq to service_role;
insert into public.wg_campaigns(slug,name) values('website-launch-grant','VAELTX Website Launch Grant');
