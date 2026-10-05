alter table public.va_outbox add column delivery_message jsonb;
-- Retained campaign tables are intentionally inaccessible to browser roles.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'wg_%' loop
  execute format('create policy %I on public.%I for all to anon,authenticated using(false) with check(false)',t.tablename||'_deny_browser',t.tablename);
 end loop;
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
