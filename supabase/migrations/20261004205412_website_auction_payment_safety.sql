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
  if a.environment='production' then
   perform va_notify('paid:'||w.id,'payment_received','participant',w.participant_id,to_jsonb(w));
   perform va_notify('owner-paid:'||w.id,'payment_received','owner',w.participant_id,to_jsonb(w));
  end if;
 else
  update va_winners set status='review',payment_intent_id=p_intent,checkout_state='paid' where id=w.id; outcome:='late_payment_review';
  if a.environment='production' then perform va_notify('late:'||w.id,'late_payment_review','owner',w.participant_id,to_jsonb(w)); end if;
 end if;
 insert into va_stripe_events(id,kind,mode,result) values(p_event,'payment',p_mode,outcome);
 insert into va_audit(auction_id,actor_id,kind,details) values(a.id,w.participant_id,'payment_'||outcome,jsonb_build_object('winnerId',w.id,'eventId',p_event));
 perform va_refresh(a.id); return jsonb_build_object('result',outcome);
end $$;