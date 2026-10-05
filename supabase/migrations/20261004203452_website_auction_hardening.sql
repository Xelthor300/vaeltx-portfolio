-- Production launch gates and scheduling. The scheduler never activates an auction.
create function public.va_validate_activation() returns trigger language plpgsql set search_path=public as $$
declare k text;
begin
 if new.status='active' and old.status='ready_for_activation' and new.environment='production' then
  foreach k in array array['seller_identity','delivery_timeline','tax_policy','governing_law','refund_policy','ownership_policy','privacy_policy'] loop
   if jsonb_typeof(new.commercial_terms->k)<>'string' or coalesce(length(trim(new.commercial_terms->>k)),0)<12 then raise exception 'commercial_policy_missing: %',k; end if;
  end loop;
  if jsonb_typeof(new.commercial_terms->'eligible_countries')<>'array' or coalesce(jsonb_array_length(new.commercial_terms->'eligible_countries'),0)=0 then raise exception 'eligible_countries_missing'; end if;
 end if;
 return new;
end $$;
create trigger va_validate_activation before update on public.va_auctions for each row execute function public.va_validate_activation();
create function public.va_validate_bidder() returns trigger language plpgsql set search_path=public as $$
declare a va_auctions; p va_participants;
begin
 select * into strict a from va_auctions where id=new.auction_id;
 if a.environment='production' then
  select * into strict p from va_participants where id=new.participant_id;
  if not exists(select 1 from auth.users where id=p.id and email_confirmed_at is not null and lower(email)=lower(p.email)) then raise exception 'verified_email_required'; end if;
  if not coalesce(a.commercial_terms->'eligible_countries' ? p.country,false) then raise exception 'country_not_eligible'; end if;
 end if;
 return new;
end $$;
create trigger va_validate_bidder before insert on public.va_bids for each row execute function public.va_validate_bidder();
do $$ declare t text; f record; begin
 foreach t in array array['va_auctions','va_participants','va_admins','va_bids','va_winners','va_payment_setups','va_extensions','va_audit','va_outbox','va_stripe_events','va_rate_limits','va_onboarding'] loop
  execute format('create policy %I on public.%I for all to anon,authenticated using(false) with check(false)',t||'_deny_browser',t);
 end loop;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('va_validate_activation','va_validate_bidder') loop
  execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 end loop;
end $$;

-- START HOSTED SCHEDULER: not available in the embedded PostgreSQL test runtime.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create function public.va_configure_scheduler(p_secret text) returns void language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
 if length(p_secret)<64 then raise exception 'invalid_operations_secret'; end if;
 select id into sid from vault.secrets where name='va_auction_operations';
 if sid is null then perform vault.create_secret(p_secret,'va_auction_operations','Auction scheduler authorization');
 else perform vault.update_secret(sid,p_secret,'va_auction_operations','Auction scheduler authorization'); end if;
end $$;
revoke all on function public.va_configure_scheduler(text) from public,anon,authenticated;
grant execute on function public.va_configure_scheduler(text) to service_role;
select cron.schedule('vaeltx-auction-operations','* * * * *',$cron$
 select net.http_get(
  url:='https://vaeltx-portfolio.vercel.app/api/website-auction/operations',
  headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='va_auction_operations')),
  timeout_milliseconds:=20000
 ) where (exists(select 1 from public.va_auctions where environment='production' and status in ('active','payment_pending'))
  or exists(select 1 from public.va_outbox where status in ('pending','leased') and next_attempt_at<=now()))
 and exists(select 1 from vault.secrets where name='va_auction_operations');
$cron$);
-- END HOSTED SCHEDULER

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
 payload:=jsonb_build_object('auctionId',a.id,'bidId',b.id,'amount',b.amount,'alias',p.alias,'businessName',p.business_name,'at',b.created_at);
 if a.environment='production' then
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

alter table public.va_winners add column checkout_expires_at timestamptz;
create or replace function public.va_reserve_checkout(p_winner uuid,p_user uuid) returns jsonb language plpgsql set search_path=public as $$
declare aid uuid; a va_auctions; w va_winners;
begin
 select auction_id into strict aid from va_winners where id=p_winner;
 select * into strict a from va_auctions where id=aid for update;
 select * into strict w from va_winners where id=p_winner for update;
 if w.participant_id<>p_user or w.status<>'pending' or clock_timestamp()>=w.deadline then raise exception 'payment_unavailable'; end if;
 if w.checkout_state='expired' then raise exception 'checkout_expired'; end if;
 update va_winners set checkout_state=coalesce(checkout_state,'creating'), checkout_expires_at=coalesce(checkout_expires_at,greatest(deadline,clock_timestamp()+interval '31 minutes')) where id=w.id returning * into w;
 return to_jsonb(w);
end $$;
drop function public.va_record_payment(text,uuid,text,text,bigint,text,text);
create function public.va_record_payment(p_event text,p_winner uuid,p_session text,p_intent text,p_amount bigint,p_currency text,p_mode text,p_paid_at timestamptz) returns jsonb
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
revoke all on function public.va_record_payment(text,uuid,text,text,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.va_record_payment(text,uuid,text,text,bigint,text,text,timestamptz) to service_role;
