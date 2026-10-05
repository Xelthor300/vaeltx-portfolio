-- Separate auction system. Preserve the disabled campaign and its historical records.
update public.wg_campaigns set status='cancelled', paid_entries_enabled=false, services_enabled=false
where slug='website-launch-grant';

create table public.va_auctions (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 environment text not null check(environment in ('production','test')),
 status text not null default 'ready_for_activation' check(status in
 ('ready_for_activation','active','paused','closed_no_sale','payment_pending','payment_expired','completed','cancelled')),
 starting_amount bigint not null default 10000 check(starting_amount=10000),
 reserve_amount bigint not null default 35000 check(reserve_amount=35000),
 minimum_increment bigint not null default 1000 check(minimum_increment=1000),
 currency text not null default 'usd' check(currency='usd'),
 starts_at timestamptz, original_ends_at timestamptz, ends_at timestamptz, paused_at timestamptz,
 closed_at timestamptz, reserve_met_at timestamptz, extension_count integer not null default 0,
 terms_version text not null default 'auction-v1',
 activation_checks jsonb not null default '{"stripe_business_review":false,"live_payments":false,"tax_and_invoicing":false,"seller_identity":false,"eligibility":false,"delivery_terms":false,"email_delivery":false,"end_to_end_qa":false}',
 commercial_terms jsonb not null default '{}', created_at timestamptz not null default now(),
 check ((starts_at is null)=(original_ends_at is null)), check(ends_at is null or ends_at>=original_ends_at)
);
create table public.va_participants (
 id uuid primary key references auth.users(id), alias text not null unique,
 full_name text not null, business_name text not null, email text not null, phone text not null,
 country text not null, city text not null, website text, terms_version text not null,
 accepted_at timestamptz not null, adult_confirmed boolean not null check(adult_confirmed),
 privacy_accepted boolean not null check(privacy_accepted), commitment_accepted boolean not null check(commitment_accepted),
 status text not null default 'eligible' check(status in ('eligible','blocked')),
 stripe_customer_id text unique, payment_method_id text, verified_mode text check(verified_mode in ('test','live')),
 verified_at timestamptz, created_at timestamptz not null default now()
);
create table public.va_admins (user_id uuid primary key references auth.users(id), role text not null check(role in ('owner','operator')));
create table public.va_bids (
 id bigint generated always as identity primary key, auction_id uuid not null references public.va_auctions(id),
 participant_id uuid not null references public.va_participants(id), amount bigint not null check(amount between 10000 and 99999999),
 request_id uuid not null unique, status text not null default 'valid' check(status in ('valid','invalidated')),
 created_at timestamptz not null default clock_timestamp(), invalidation_reason text
);
create index va_bids_ranking on public.va_bids(auction_id, amount desc, id asc) where status='valid';
create index va_bids_participant on public.va_bids(participant_id, auction_id);
create table public.va_winners (
 id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.va_auctions(id),
 bid_id bigint not null unique references public.va_bids(id), participant_id uuid not null references public.va_participants(id),
 amount bigint not null, currency text not null default 'usd' check(currency='usd'),
 status text not null default 'pending' check(status in ('pending','expired','paid','declined','review')),
 is_backup boolean not null default false, offered_at timestamptz not null, deadline timestamptz not null,
 checkout_session_id text unique, payment_intent_id text unique, checkout_state text check(checkout_state in ('creating','open','expired','paid')),
 paid_at timestamptz, check(amount>=35000), check(deadline>offered_at)
);
create unique index va_one_pending_winner on public.va_winners(auction_id) where status in ('pending','paid');
create index va_winners_participant on public.va_winners(participant_id);
create table public.va_payment_setups (
 id uuid primary key default gen_random_uuid(), participant_id uuid not null references public.va_participants(id),
 session_id text unique, customer_id text not null, mode text not null check(mode in ('test','live')),
 setup_intent_id text unique, status text not null default 'pending' check(status in ('pending','verified','expired')),
 created_at timestamptz not null default now()
);
create index va_setups_participant on public.va_payment_setups(participant_id);
create table public.va_extensions (
 id bigint generated always as identity primary key, auction_id uuid not null references public.va_auctions(id),
 bid_id bigint not null unique references public.va_bids(id), previous_end timestamptz not null, extended_end timestamptz not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.va_audit (
 id bigint generated always as identity primary key, auction_id uuid references public.va_auctions(id), actor_id uuid,
 kind text not null, details jsonb not null default '{}', created_at timestamptz not null default clock_timestamp()
);
create index va_audit_auction on public.va_audit(auction_id, id);
create table public.va_outbox (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique, kind text not null,
 audience text not null check(audience in ('owner','participant')), participant_id uuid references public.va_participants(id),
 payload jsonb not null, status text not null default 'pending' check(status in ('pending','leased','sent','review')),
 attempts integer not null default 0, lease_until timestamptz, first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
 provider_id text, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
create index va_outbox_pending on public.va_outbox(next_attempt_at) where status in ('pending','leased');
create index va_outbox_participant on public.va_outbox(participant_id);
create table public.va_stripe_events (id text primary key, kind text not null, mode text not null, result text not null, received_at timestamptz not null default now());
create table public.va_rate_limits (key text primary key, window_start timestamptz not null, count integer not null);
create table public.va_onboarding (
 winner_id uuid primary key references public.va_winners(id), participant_id uuid not null references public.va_participants(id),
 responses jsonb not null, submitted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index va_onboarding_participant on public.va_onboarding(participant_id);
create function public.va_winner_immutable() returns trigger language plpgsql set search_path=public as $$
begin
 if row(new.auction_id,new.bid_id,new.participant_id,new.amount,new.currency,new.offered_at,new.deadline,new.is_backup)
 is distinct from row(old.auction_id,old.bid_id,old.participant_id,old.amount,old.currency,old.offered_at,old.deadline,old.is_backup)
 then raise exception 'winner_offer_immutable'; end if;
 return new;
end $$;
create trigger va_winner_immutable before update on public.va_winners for each row execute function public.va_winner_immutable();
-- Only this table is published to Realtime. Never publish participants, bids or payment tables.
create table public.va_public_state (
 auction_id uuid primary key references public.va_auctions(id), slug text not null unique,
 environment text not null, status text not null, current_amount bigint, next_minimum bigint not null,
 reserve_amount bigint not null, reserve_met boolean not null, bid_count integer not null,
 participant_count integer not null, starts_at timestamptz, ends_at timestamptz,
 extension_count integer not null, updated_at timestamptz not null default clock_timestamp()
);

create function public.va_refresh(p_auction uuid) returns void language plpgsql set search_path=public as $$
declare a va_auctions; high bigint; n integer; pn integer;
begin
 select * into strict a from va_auctions where id=p_auction;
 select max(b.amount),count(*) into high,n from va_bids b join va_participants p on p.id=b.participant_id
 where b.auction_id=a.id and b.status='valid' and p.status='eligible';
 select count(distinct b.participant_id) into pn from va_bids b join va_participants p on p.id=b.participant_id
 where b.auction_id=a.id and b.status='valid' and p.status='eligible';
 insert into va_public_state values(a.id,a.slug,a.environment,a.status,high,coalesce(high+a.minimum_increment,a.starting_amount),
 a.reserve_amount,coalesce(high>=a.reserve_amount,false),n,pn,a.starts_at,a.ends_at,a.extension_count,clock_timestamp())
 on conflict(auction_id) do update set status=excluded.status,current_amount=excluded.current_amount,next_minimum=excluded.next_minimum,
 reserve_met=excluded.reserve_met,bid_count=excluded.bid_count,participant_count=excluded.participant_count,
 starts_at=excluded.starts_at,ends_at=excluded.ends_at,extension_count=excluded.extension_count,updated_at=excluded.updated_at;
end $$;

create function public.va_notify(p_key text,p_kind text,p_audience text,p_user uuid,p_payload jsonb) returns void
language sql set search_path=public as $$
 insert into va_outbox(dedupe_key,kind,audience,participant_id,payload) values(p_key,p_kind,p_audience,p_user,p_payload)
 on conflict(dedupe_key) do nothing;
$$;

create function public.va_place_bid(p_auction uuid,p_user uuid,p_amount bigint,p_request uuid) returns jsonb
language plpgsql set search_path=public as $$
declare a va_auctions; p va_participants; previous va_bids; existing va_bids; b va_bids; t timestamptz; min_amount bigint; payload jsonb; problem text;
begin
 select * into strict a from va_auctions where id=p_auction for update;
 t:=clock_timestamp();
 select * into existing from va_bids where request_id=p_request;
 if found then
  if existing.participant_id=p_user and existing.auction_id=p_auction and existing.amount=p_amount then
   return jsonb_build_object('ok',true,'bidId',existing.id,'duplicate',true);
  end if;
  return jsonb_build_object('ok',false,'code','request_conflict');
 end if;
 select * into p from va_participants where id=p_user for update;
 select b0.* into previous from va_bids b0 join va_participants p0 on p0.id=b0.participant_id
 where b0.auction_id=a.id and b0.status='valid' and p0.status='eligible' order by b0.amount desc,b0.id asc limit 1;
 min_amount:=coalesce(previous.amount+a.minimum_increment,a.starting_amount);
 if a.status<>'active' then problem:='auction_not_active';
 elsif t<a.starts_at or t>=a.ends_at then problem:='auction_ended';
 elsif p.id is null or p.status<>'eligible' or p.terms_version<>a.terms_version then problem:='profile_required';
 elsif p.verified_at is null or p.payment_method_id is null or p.verified_mode<>(case when a.environment='production' then 'live' else 'test' end) then problem:='card_verification_required';
 elsif p_amount is null or p_amount<min_amount or p_amount>99999999 then problem:='bid_too_low'; end if;
 if problem is not null then
  insert into va_audit(auction_id,actor_id,kind,details) values(a.id,p_user,'bid_rejected',jsonb_build_object('reason',problem,'amount',p_amount,'minimum',min_amount));
  return jsonb_build_object('ok',false,'code',problem,'nextMinimum',min_amount,'endsAt',a.ends_at);
 end if;
 insert into va_bids(auction_id,participant_id,amount,request_id) values(a.id,p_user,p_amount,p_request) returning * into b;
 if a.ends_at-t<=interval '120 seconds' then
  insert into va_extensions(auction_id,bid_id,previous_end,extended_end) values(a.id,b.id,a.ends_at,a.ends_at+interval '120 seconds');
  update va_auctions set ends_at=ends_at+interval '120 seconds',extension_count=extension_count+1 where id=a.id;
 end if;
 payload:=jsonb_build_object('auctionId',a.id,'bidId',b.id,'amount',b.amount,'alias',p.alias,'businessName',p.business_name,'at',b.created_at);
 if a.environment='production' then
  perform va_notify('owner-bid:'||b.id,'bid_accepted','owner',p_user,payload);
  perform va_notify('bidder-bid:'||b.id,'bid_confirmation','participant',p_user,payload);
  if previous.participant_id is not null and previous.participant_id<>p_user then
   perform va_notify('outbid:'||b.id,'outbid','participant',previous.participant_id,payload);
  end if;
  if p_amount>=a.reserve_amount and a.reserve_met_at is null then
   perform va_notify('reserve:'||a.id,'reserve_met','owner',null,payload);
  end if;
 end if;
 if p_amount>=a.reserve_amount and a.reserve_met_at is null then update va_auctions set reserve_met_at=t where id=a.id; end if;
 insert into va_audit(auction_id,actor_id,kind,details) values(a.id,p_user,'bid_accepted',payload);
 perform va_refresh(a.id);
 return jsonb_build_object('ok',true,'bidId',b.id,'duplicate',false);
end $$;

create function public.va_close(p_auction uuid) returns jsonb language plpgsql set search_path=public as $$
declare a va_auctions; b va_bids; w va_winners; t timestamptz;
begin
 select * into strict a from va_auctions where id=p_auction for update; t:=clock_timestamp();
 if a.status<>'active' or t<a.ends_at then return jsonb_build_object('changed',false); end if;
 select b0.* into b from va_bids b0 join va_participants p on p.id=b0.participant_id
 where b0.auction_id=a.id and b0.status='valid' and p.status='eligible' order by b0.amount desc,b0.id asc limit 1;
 if b.id is null or b.amount<a.reserve_amount then
  update va_auctions set status='closed_no_sale',closed_at=t where id=a.id;
  if a.environment='production' then perform va_notify('no-sale:'||a.id,'closed_no_sale','owner',null,jsonb_build_object('auctionId',a.id)); end if;
 else
  insert into va_winners(auction_id,bid_id,participant_id,amount,offered_at,deadline) values(a.id,b.id,b.participant_id,b.amount,t,t+interval '24 hours') returning * into w;
  update va_auctions set status='payment_pending',closed_at=t where id=a.id;
  if a.environment='production' then
   perform va_notify('winner:'||w.id,'winner','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-winner:'||w.id,'winner','owner',w.participant_id,to_jsonb(w));
  end if;
 end if;
 if a.environment='production' then
  insert into va_outbox(dedupe_key,kind,audience,participant_id,payload)
  select 'closed:'||a.id||':'||participant_id,'auction_closed','participant',participant_id,jsonb_build_object('auctionId',a.id,'sold',w.id is not null)
  from va_bids where auction_id=a.id group by participant_id on conflict(dedupe_key) do nothing;
 end if;
 insert into va_audit(auction_id,kind,details) values(a.id,'auction_closed',jsonb_build_object('winnerId',w.id,'amount',w.amount,'closedAt',t));
 perform va_refresh(a.id); return jsonb_build_object('changed',true,'winnerId',w.id);
end $$;

create function public.va_admin_action(p_auction uuid,p_actor uuid,p_action text,p_reason text,p_bid bigint default null) returns jsonb
language plpgsql set search_path=public as $$
declare a va_auctions; t timestamptz; b va_bids; w va_winners; checklist text[]:=array['stripe_business_review','live_payments','tax_and_invoicing','seller_identity','eligibility','delivery_terms','email_delivery','end_to_end_qa']; k text;
begin
 if not exists(select 1 from va_admins where user_id=p_actor and role='owner') then raise exception 'admin_required'; end if;
 if length(trim(p_reason))<12 then raise exception 'reason_required'; end if;
 select * into strict a from va_auctions where id=p_auction for update; t:=clock_timestamp();
 if p_action='activate' then
  if a.status<>'ready_for_activation' then raise exception 'invalid_status'; end if;
  foreach k in array checklist loop
   if coalesce(a.activation_checks->>k,'false')<>'true' then raise exception 'activation_gate_missing: %',k; end if;
  end loop;
  if not (a.commercial_terms ?& array['seller_identity','eligible_countries','delivery_timeline','tax_policy','governing_law','refund_policy']) then raise exception 'commercial_terms_missing'; end if;
  update va_auctions set status='active',starts_at=t,original_ends_at=t+interval '25 days',ends_at=t+interval '25 days' where id=a.id;
 elsif p_action='pause' then
  if a.status<>'active' or t>=a.ends_at then raise exception 'invalid_status'; end if;
  update va_auctions set status='paused',paused_at=t where id=a.id;
 elsif p_action='resume' then
  if a.status<>'paused' then raise exception 'invalid_status'; end if;
  update va_auctions set status='active',ends_at=ends_at+(t-paused_at),paused_at=null where id=a.id;
 elsif p_action='cancel' then
  if a.status not in ('ready_for_activation','active','paused','closed_no_sale','payment_expired') then raise exception 'invalid_status'; end if;
  update va_auctions set status='cancelled' where id=a.id;
 elsif p_action='invalidate' then
  if a.status not in ('active','paused') then raise exception 'invalid_status'; end if;
  update va_bids set status='invalidated',invalidation_reason=p_reason where auction_id=a.id and id=p_bid and status='valid';
  if not found then raise exception 'bid_not_found'; end if;
 elsif p_action='backup' then
  if a.status<>'payment_expired' then raise exception 'invalid_status'; end if;
  select b0.* into b from va_bids b0 join va_participants p on p.id=b0.participant_id
  where b0.auction_id=a.id and b0.status='valid' and p.status='eligible' and b0.amount>=a.reserve_amount
  and not exists(select 1 from va_winners w0 where w0.auction_id=a.id and w0.participant_id=b0.participant_id)
  order by b0.amount desc,b0.id asc limit 1;
  if b.id is null then raise exception 'no_eligible_backup'; end if;
  insert into va_winners(auction_id,bid_id,participant_id,amount,is_backup,offered_at,deadline) values(a.id,b.id,b.participant_id,b.amount,true,t,t+interval '24 hours') returning * into w;
  update va_auctions set status='payment_pending' where id=a.id;
  if a.environment='production' then
   perform va_notify('winner:'||w.id,'backup_offer','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-winner:'||w.id,'backup_offer','owner',w.participant_id,to_jsonb(w));
  end if;
 else raise exception 'unknown_action'; end if;
 insert into va_audit(auction_id,actor_id,kind,details) values(a.id,p_actor,'admin_'||p_action,jsonb_build_object('reason',p_reason,'bidId',p_bid,'at',t));
 perform va_refresh(a.id); return jsonb_build_object('ok',true);
end $$;

create function public.va_expire_winner(p_winner uuid) returns boolean language plpgsql set search_path=public as $$
declare aid uuid; a va_auctions; w va_winners;
begin
 select auction_id into strict aid from va_winners where id=p_winner;
 select * into strict a from va_auctions where id=aid for update;
 select * into strict w from va_winners where id=p_winner for update;
 if w.status<>'pending' or clock_timestamp()<w.deadline or w.checkout_state in ('creating','open','paid') then return false; end if;
 update va_winners set status='expired' where id=w.id;
 update va_auctions set status='payment_expired' where id=a.id;
 if a.environment='production' then
  perform va_notify('expired:'||w.id,'payment_expired','participant',w.participant_id,to_jsonb(w));
  perform va_notify('owner-expired:'||w.id,'payment_expired','owner',w.participant_id,to_jsonb(w));
 end if;
 insert into va_audit(auction_id,kind,details) values(a.id,'payment_expired',jsonb_build_object('winnerId',w.id));
 perform va_refresh(a.id); return true;
end $$;

create function public.va_record_payment(p_event text,p_winner uuid,p_session text,p_intent text,p_amount bigint,p_currency text,p_mode text) returns jsonb
language plpgsql set search_path=public as $$
declare aid uuid; a va_auctions; w va_winners; outcome text;
begin
 select auction_id into strict aid from va_winners where id=p_winner;
 select * into strict a from va_auctions where id=aid for update;
 if exists(select 1 from va_stripe_events where id=p_event) then return jsonb_build_object('duplicate',true); end if;
 select * into strict w from va_winners where id=p_winner for update;
 if p_amount<>w.amount or p_currency<>'usd' or p_mode<>(case when a.environment='production' then 'live' else 'test' end)
 or w.checkout_session_id is distinct from p_session then raise exception 'payment_mismatch'; end if;
 if w.status='paid' and w.payment_intent_id=p_intent then outcome:='already_paid';
 elsif w.status='pending' then
  update va_winners set status='paid',checkout_state='paid',payment_intent_id=p_intent,paid_at=clock_timestamp() where id=w.id;
  update va_auctions set status='completed' where id=a.id; outcome:='paid';
  if a.environment='production' then
   perform va_notify('paid:'||w.id,'payment_received','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-paid:'||w.id,'payment_received','owner',w.participant_id,to_jsonb(w));
  end if;
 else
  update va_winners set status='review',payment_intent_id=p_intent,checkout_state='paid' where id=w.id; outcome:='late_payment_review';
  perform va_notify('late:'||w.id,'late_payment_review','owner',w.participant_id,to_jsonb(w));
 end if;
 insert into va_stripe_events(id,kind,mode,result) values(p_event,'payment',p_mode,outcome);
 insert into va_audit(auction_id,actor_id,kind,details) values(a.id,w.participant_id,'payment_'||outcome,jsonb_build_object('winnerId',w.id,'eventId',p_event));
 perform va_refresh(a.id); return jsonb_build_object('result',outcome);
end $$;

create function public.va_reserve_checkout(p_winner uuid,p_user uuid) returns jsonb language plpgsql set search_path=public as $$
declare aid uuid; a va_auctions; w va_winners;
begin
 select auction_id into strict aid from va_winners where id=p_winner;
 select * into strict a from va_auctions where id=aid for update;
 select * into strict w from va_winners where id=p_winner for update;
 if w.participant_id<>p_user or w.status<>'pending' or clock_timestamp()>=w.deadline then raise exception 'payment_unavailable'; end if;
 if w.checkout_state='expired' then raise exception 'checkout_expired'; end if;
 update va_winners set checkout_state=coalesce(checkout_state,'creating') where id=w.id;
 return to_jsonb(w);
end $$;

create function public.va_record_setup(p_event text,p_setup uuid,p_intent text,p_method text,p_mode text) returns void
language plpgsql set search_path=public as $$
declare s va_payment_setups;
begin
 select * into strict s from va_payment_setups where id=p_setup for update;
 if exists(select 1 from va_stripe_events where id=p_event) then return; end if;
 if s.mode<>p_mode or s.status='expired' then raise exception 'setup_mismatch'; end if;
 update va_payment_setups set status='verified',setup_intent_id=p_intent where id=s.id;
 update va_participants set payment_method_id=p_method,verified_mode=p_mode,verified_at=clock_timestamp()
 where id=s.participant_id and stripe_customer_id=s.customer_id;
 if not found then raise exception 'setup_customer_mismatch'; end if;
 insert into va_stripe_events(id,kind,mode,result) values(p_event,'setup',p_mode,'verified');
end $$;

create function public.va_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql set search_path=public as $$
declare r va_rate_limits; t timestamptz:=clock_timestamp();
begin
 insert into va_rate_limits values(p_key,t,1) on conflict(key) do nothing;
 if found then return true; end if;
 select * into strict r from va_rate_limits where key=p_key for update;
 if t-r.window_start>=make_interval(secs=>p_seconds) then update va_rate_limits set window_start=t,count=1 where key=p_key; return true; end if;
 if r.count>=p_limit then return false; end if;
 update va_rate_limits set count=count+1 where key=p_key; return true;
end $$;

create function public.va_lease_notifications(p_limit integer default 10) returns setof public.va_outbox language sql set search_path=public as $$
 update va_outbox set status='leased',lease_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp())
 where id in (select id from va_outbox where (status='pending' or (status='leased' and lease_until<clock_timestamp())) and next_attempt_at<=clock_timestamp()
 order by created_at limit least(p_limit,30) for update skip locked) returning *;
$$;

-- Service credentials stay on the server. Browser roles cannot read or mutate private data.
do $$ declare t text; f record; begin
 foreach t in array array['va_auctions','va_participants','va_admins','va_bids','va_winners','va_payment_setups','va_extensions','va_audit','va_outbox','va_stripe_events','va_rate_limits','va_onboarding','va_public_state'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'va_%' loop
  execute 'revoke all on function '||f.signature||' from public, anon, authenticated';
  execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
grant usage,select on sequence public.va_bids_id_seq,public.va_extensions_id_seq,public.va_audit_id_seq to service_role;
grant select on public.va_public_state to anon,authenticated;
create policy va_public_production on public.va_public_state for select to anon,authenticated using(environment='production');
alter publication supabase_realtime add table public.va_public_state;
insert into public.va_auctions(slug,environment) values('website-auction','production');
select public.va_refresh(id) from public.va_auctions where slug='website-auction';
