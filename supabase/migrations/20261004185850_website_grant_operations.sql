-- Freeze the eligible pool in the same transaction that records a selection.
-- The server supplies an unbiased crypto.randomInt offset; public roles cannot call this.
create function public.wg_record_selection(p_campaign uuid,p_offset bigint,p_expected_count bigint) returns jsonb language plpgsql set search_path='' as $$
declare c public.wg_campaigns; total bigint; selected public.wg_entries; pool_hash text;
begin
  select * into c from public.wg_campaigns where id=p_campaign for update;
  if c.status <> 'selection_pending' or c.end_at > now() or c.selection_mode <> 'random' or c.legal_approved_at is null then raise exception 'SELECTION_NOT_READY'; end if;
  lock table public.wg_entries in share mode;
  if exists(select 1 from public.wg_orders where campaign_id=p_campaign and status in ('pending','review','disputed')) then raise exception 'PAYMENT_RECONCILIATION_REQUIRED'; end if;
  select count(*),encode(sha256(convert_to(coalesce(string_agg(id::text,',' order by id),''),'UTF8')),'hex') into total,pool_hash from public.wg_entries where campaign_id=p_campaign and status='valid';
  if total <> p_expected_count or total=0 or p_offset<0 or p_offset>=total then raise exception 'POOL_CHANGED'; end if;
  select * into selected from public.wg_entries where campaign_id=p_campaign and status='valid' order by id offset p_offset limit 1;
  insert into public.wg_winner_selections(campaign_id,entry_id,eligible_pool_count,pool_digest,algorithm_version) values(p_campaign,selected.id,total,pool_hash,'node-crypto-randomInt-offset-v1');
  update public.wg_campaigns set status='selected' where id=p_campaign;
  insert into public.wg_audit_logs(campaign_id,action,subject_id) values(p_campaign,'winner_selected',selected.entry_number);
  return jsonb_build_object('entry_number',selected.entry_number,'eligible_pool_count',total,'pool_digest',pool_hash);
end; $$;
revoke all on function public.wg_record_selection(uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.wg_record_selection(uuid,bigint,bigint) to service_role;

create function public.wg_campaign_audit() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status is distinct from new.status then
    insert into public.wg_audit_logs(campaign_id,action,subject_id) values(new.id,'campaign_status_' || new.status,new.id::text);
  end if;
  return new;
end; $$;
revoke all on function public.wg_campaign_audit() from public,anon,authenticated;
grant execute on function public.wg_campaign_audit() to service_role;
create trigger wg_status_audit after update on public.wg_campaigns for each row execute function public.wg_campaign_audit();
create index wg_order_participant on public.wg_orders(participant_id,created_at);
create index wg_order_campaign_status on public.wg_orders(campaign_id,status);
create index wg_entries_order on public.wg_entries(order_id);
create index wg_outbox_pending on public.wg_email_outbox(created_at) where sent_at is null;
create index wg_outbox_participant on public.wg_email_outbox(participant_id);
create index wg_payment_event_order on public.wg_payment_events(order_id);
create index wg_audit_campaign on public.wg_audit_logs(campaign_id,created_at);
create index wg_selection_campaign on public.wg_winner_selections(campaign_id);
create index wg_selection_entry on public.wg_winner_selections(entry_id);
