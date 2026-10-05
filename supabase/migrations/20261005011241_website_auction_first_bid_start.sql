-- Future owner approval enables bidding without starting a clock. No row is activated here.
alter table public.va_auctions drop constraint va_auctions_status_check;
alter table public.va_auctions add constraint va_auctions_status_check check(status in ('ready_for_activation','waiting_for_first_bid','active','paused','closed_no_sale','payment_pending','payment_expired','completed','cancelled'));
alter table public.va_auctions add constraint va_waiting_without_clock check(status<>'waiting_for_first_bid' or (starts_at is null and original_ends_at is null and ends_at is null));
create or replace function public.va_validate_activation() returns trigger language plpgsql set search_path=public as $$
declare k text;
begin
 if new.environment='production' and new.status in ('waiting_for_first_bid','active') and old.status in ('ready_for_activation','waiting_for_first_bid') then
  foreach k in array array['stripe_business_review','live_payments','tax_and_invoicing','seller_identity','eligibility','delivery_terms','email_delivery','end_to_end_qa'] loop
   if coalesce(new.activation_checks->>k,'false')<>'true' then raise exception 'activation_gate_missing: %',k; end if;
  end loop;
  foreach k in array array['seller_identity','delivery_timeline','tax_policy','governing_law','refund_policy','ownership_policy','privacy_policy'] loop
   if jsonb_typeof(new.commercial_terms->k)<>'string' or coalesce(length(trim(new.commercial_terms->>k)),0)<12 then raise exception 'commercial_policy_missing: %',k; end if;
  end loop;
  if jsonb_typeof(new.commercial_terms->'eligible_countries')<>'array' or coalesce(jsonb_array_length(new.commercial_terms->'eligible_countries'),0)=0 then raise exception 'eligible_countries_missing'; end if;
 end if;
 if old.starts_at is not null and new.starts_at is distinct from old.starts_at then raise exception 'auction_start_immutable'; end if;
 if new.environment='production' and old.original_ends_at is not null and new.original_ends_at is distinct from old.original_ends_at then raise exception 'original_deadline_immutable'; end if;
 return new;
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
 if a.status not in ('active','waiting_for_first_bid') then problem:='auction_not_active';
 elsif a.status='active' and (t<a.starts_at or t>=a.ends_at) then problem:='auction_ended';
 elsif p.id is null or p.status<>'eligible' or p.terms_version<>a.terms_version then problem:='profile_required';
 elsif p.verified_at is null or p.payment_method_id is null or p.verified_mode<>(case when a.environment='production' then 'live' else 'test' end) then problem:='card_verification_required';
 elsif p_amount is null or p_amount<min_amount or p_amount>99999999 then problem:='bid_too_low'; end if;
 if problem is not null then
  insert into va_audit(auction_id,actor_id,kind,details) values(a.id,p_user,'bid_rejected',jsonb_build_object('reason',problem,'amount',p_amount,'minimum',min_amount));
  return jsonb_build_object('ok',false,'code',problem,'nextMinimum',min_amount,'endsAt',a.ends_at);
 end if;
 if a.status='waiting_for_first_bid' then
  if a.starts_at is not null or a.ends_at is not null or exists(select 1 from va_bids where auction_id=a.id and status='valid') then raise exception 'first_bid_state_invalid'; end if;
  update va_auctions set status='active',starts_at=t,original_ends_at=t+interval '25 days',ends_at=t+interval '25 days' where id=a.id returning * into a;
  insert into va_audit(auction_id,actor_id,kind,details) values(a.id,p_user,'auction_started_by_first_valid_bid',jsonb_build_object('startsAt',t,'originalEndsAt',a.original_ends_at));
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
   perform va_notify('outbid:'||b.id,'outbid','participant',previous.participant_id,
    jsonb_build_object('auctionId',a.id,'bidId',b.id,'previousAmount',previous.amount,'currentHighest',b.amount,'nextMinimum',b.amount+a.minimum_increment,'endsAt',(select ends_at from va_auctions where id=a.id)));
   -- Preserve every loss-of-lead event; space rapid notifications instead of dropping them.
   update va_outbox o set next_attempt_at=greatest(o.next_attempt_at,coalesce((select max(greatest(x.next_attempt_at,coalesce(x.sent_at,x.created_at)))+interval '10 minutes' from va_outbox x where x.kind='outbid' and x.participant_id=previous.participant_id and x.payload->>'auctionId'=a.id::text and x.id<>o.id),o.next_attempt_at)) where o.dedupe_key='outbid:'||b.id;
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
  update va_auctions set status='waiting_for_first_bid',starts_at=null,original_ends_at=null,ends_at=null where id=a.id;
 elsif p_action='pause' then
  if a.status<>'active' or t>=a.ends_at then raise exception 'invalid_status'; end if;
  update va_auctions set status='paused',paused_at=t where id=a.id;
 elsif p_action='resume' then
  if a.status<>'paused' then raise exception 'invalid_status'; end if;
  update va_auctions set status='active',ends_at=ends_at+(t-paused_at),paused_at=null where id=a.id;
 elsif p_action='cancel' then
  if a.status not in ('ready_for_activation','waiting_for_first_bid','active','paused','closed_no_sale','payment_expired') then raise exception 'invalid_status'; end if;
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

