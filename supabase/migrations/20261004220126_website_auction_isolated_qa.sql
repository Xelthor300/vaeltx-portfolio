-- Private opt-in for isolated, authenticated Stripe TEST preview journeys.
create table public.va_qa_runs (
 auction_id uuid primary key references public.va_auctions(id),
 enabled boolean not null default false,
 site_url text not null check(site_url ~ '^https://[a-z0-9-]+\.vercel\.app$')
);
create table public.va_qa_access (
 auction_id uuid not null references public.va_qa_runs(auction_id),
 user_id uuid not null references auth.users(id), primary key(auction_id,user_id)
);
create function public.va_validate_qa_run() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from va_auctions where id=new.auction_id and environment='test' and slug like 'qa-ui-%') then raise exception 'qa_requires_test_auction'; end if;
 return new;
end $$;
create trigger va_validate_qa_run before insert or update on public.va_qa_runs for each row execute function public.va_validate_qa_run();
alter table public.va_qa_runs enable row level security;
alter table public.va_qa_access enable row level security;
revoke all on public.va_qa_runs,public.va_qa_access from anon,authenticated;
grant all on public.va_qa_runs,public.va_qa_access to service_role;
grant select on public.va_qa_access to authenticated;
create policy va_qa_own_access on public.va_qa_access for select to authenticated using(user_id=(select auth.uid()));
create policy va_qa_snapshot on public.va_public_state for select to authenticated using(environment='test' and exists(select 1 from public.va_qa_access q where q.auction_id=va_public_state.auction_id and q.user_id=(select auth.uid())));
create function public.va_should_notify(p_auction uuid) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from va_auctions a where a.id=p_auction and (a.environment='production' or (a.environment='test' and exists(select 1 from va_qa_runs q where q.auction_id=a.id and q.enabled))));
$$;
create or replace function public.va_notify(p_key text,p_kind text,p_audience text,p_user uuid,p_payload jsonb) returns void language plpgsql set search_path=public as $$
declare qa_url text; a_id uuid;
begin
 a_id:=coalesce(p_payload->>'auctionId',p_payload->>'auction_id')::uuid;
 select q.site_url into qa_url from va_qa_runs q join va_auctions a on a.id=q.auction_id where q.auction_id=a_id and q.enabled and a.environment='test';
 if qa_url is not null then
  if p_user is not null and not exists(select 1 from va_qa_access where auction_id=a_id and user_id=p_user) then raise exception 'qa_recipient_not_authorized'; end if;
  p_payload:=p_payload||jsonb_build_object('qa',true,'qaURL',qa_url);
 end if;
 insert into va_outbox(dedupe_key,kind,audience,participant_id,payload) values(p_key,p_kind,p_audience,p_user,p_payload) on conflict(dedupe_key) do nothing;
end $$;

create or replace function public.va_place_bid(p_auction uuid,p_user uuid,p_amount bigint,p_request uuid) returns jsonb
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
 payload:=jsonb_build_object('auctionId',a.id,'bidId',b.id,'amount',b.amount,'alias',p.alias,'businessName',p.business_name,'fullName',p.full_name,'email',p.email,'phone',p.phone,'country',p.country,'at',b.created_at,'currentHighest',b.amount,'nextMinimum',b.amount+a.minimum_increment,'reserveAmount',a.reserve_amount,'reserveMet',b.amount>=a.reserve_amount,'validBids',(select count(*) from va_bids where auction_id=a.id and status='valid'),'verifiedBidders',(select count(distinct participant_id) from va_bids where auction_id=a.id and status='valid'),'endsAt',(select ends_at from va_auctions where id=a.id));
 if va_should_notify(a.id) then
  perform va_notify('owner-bid:'||b.id,'bid_accepted','owner',p_user,payload);
  perform va_notify('bidder-bid:'||b.id,'bid_confirmation','participant',p_user,payload);
  if previous.participant_id is not null and previous.participant_id<>p_user then
   perform va_notify('outbid:'||a.id||':'||previous.participant_id||':'||floor(extract(epoch from t)/600)::text,'outbid','participant',previous.participant_id,payload);
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

create or replace function public.va_close(p_auction uuid) returns jsonb language plpgsql set search_path=public as $$
declare a va_auctions; b va_bids; w va_winners; t timestamptz;
begin
 select * into strict a from va_auctions where id=p_auction for update; t:=clock_timestamp();
 if a.status<>'active' or t<a.ends_at then return jsonb_build_object('changed',false); end if;
 select b0.* into b from va_bids b0 join va_participants p on p.id=b0.participant_id
 where b0.auction_id=a.id and b0.status='valid' and p.status='eligible' order by b0.amount desc,b0.id asc limit 1;
 if b.id is null or b.amount<a.reserve_amount then
  update va_auctions set status='closed_no_sale',closed_at=t where id=a.id;
  if va_should_notify(a.id) then perform va_notify('no-sale:'||a.id,'closed_no_sale','owner',null,jsonb_build_object('auctionId',a.id)); end if;
 else
  insert into va_winners(auction_id,bid_id,participant_id,amount,offered_at,deadline) values(a.id,b.id,b.participant_id,b.amount,t,t+interval '24 hours') returning * into w;
  update va_auctions set status='payment_pending',closed_at=t where id=a.id;
  if va_should_notify(a.id) then
   perform va_notify('winner:'||w.id,'winner','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-winner:'||w.id,'winner','owner',w.participant_id,to_jsonb(w));
  end if;
 end if;
 if va_should_notify(a.id) then
  insert into va_outbox(dedupe_key,kind,audience,participant_id,payload)
  select 'closed:'||a.id||':'||participant_id,'auction_closed','participant',participant_id,jsonb_build_object('auctionId',a.id,'sold',w.id is not null,'qa',a.environment='test','qaURL',(select site_url from va_qa_runs where auction_id=a.id and enabled))
  from va_bids where auction_id=a.id group by participant_id on conflict(dedupe_key) do nothing;
 end if;
 insert into va_audit(auction_id,kind,details) values(a.id,'auction_closed',jsonb_build_object('winnerId',w.id,'amount',w.amount,'closedAt',t));
 perform va_refresh(a.id); return jsonb_build_object('changed',true,'winnerId',w.id);
end $$;

create or replace function public.va_admin_action(p_auction uuid,p_actor uuid,p_action text,p_reason text,p_bid bigint default null) returns jsonb
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
  if va_should_notify(a.id) then
   perform va_notify('winner:'||w.id,'backup_offer','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-winner:'||w.id,'backup_offer','owner',w.participant_id,to_jsonb(w));
  end if;
 else raise exception 'unknown_action'; end if;
 insert into va_audit(auction_id,actor_id,kind,details) values(a.id,p_actor,'admin_'||p_action,jsonb_build_object('reason',p_reason,'bidId',p_bid,'at',t));
 perform va_refresh(a.id); return jsonb_build_object('ok',true);
end $$;

create or replace function public.va_expire_winner(p_winner uuid) returns boolean language plpgsql set search_path=public as $$
declare aid uuid; a va_auctions; w va_winners;
begin
 select auction_id into strict aid from va_winners where id=p_winner;
 select * into strict a from va_auctions where id=aid for update;
 select * into strict w from va_winners where id=p_winner for update;
 if w.status<>'pending' or clock_timestamp()<w.deadline or w.checkout_state in ('creating','open','paid') then return false; end if;
 update va_winners set status='expired' where id=w.id;
 update va_auctions set status='payment_expired' where id=a.id;
 if va_should_notify(a.id) then
  perform va_notify('expired:'||w.id,'payment_expired','participant',w.participant_id,to_jsonb(w));
  perform va_notify('owner-expired:'||w.id,'payment_expired','owner',w.participant_id,to_jsonb(w));
 end if;
 insert into va_audit(auction_id,kind,details) values(a.id,'payment_expired',jsonb_build_object('winnerId',w.id));
 perform va_refresh(a.id); return true;
end $$;

create or replace function public.va_record_payment(p_event text,p_winner uuid,p_session text,p_intent text,p_amount bigint,p_currency text,p_mode text,p_paid_at timestamptz) returns jsonb
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
 elsif w.status='pending' and p_paid_at is not null and p_paid_at<=w.deadline then
  update va_winners set status='paid',checkout_state='paid',payment_intent_id=p_intent,paid_at=p_paid_at where id=w.id;
  update va_auctions set status='completed' where id=a.id; outcome:='paid';
  if va_should_notify(a.id) then
   perform va_notify('paid:'||w.id,'payment_received','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-paid:'||w.id,'payment_received','owner',w.participant_id,to_jsonb(w));
  end if;
 else
  update va_winners set status='review',payment_intent_id=p_intent,checkout_state='paid' where id=w.id; outcome:='late_payment_review';
  if va_should_notify(a.id) then perform va_notify('late:'||w.id,'late_payment_review','owner',w.participant_id,to_jsonb(w)); end if;
 end if;
 insert into va_stripe_events(id,kind,mode,result) values(p_event,'payment',p_mode,outcome);
 insert into va_audit(auction_id,actor_id,kind,details) values(a.id,w.participant_id,'payment_'||outcome,jsonb_build_object('winnerId',w.id,'eventId',p_event));
 perform va_refresh(a.id); return jsonb_build_object('result',outcome);
end $$;

revoke all on function public.va_validate_qa_run(),public.va_should_notify(uuid) from public,anon,authenticated;
grant execute on function public.va_should_notify(uuid) to service_role;
