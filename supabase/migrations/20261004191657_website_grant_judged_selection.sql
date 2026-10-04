-- Owner clarification: team evaluation, no random selection and no ticket weighting.
alter table public.wg_campaigns alter column selection_mode set default 'judged';
update public.wg_campaigns set selection_mode='judged' where slug='website-launch-grant' and status='draft';
alter table public.wg_winner_selections add column decision jsonb;
alter table public.wg_winner_selections add column eligible_application_count bigint;
drop function public.wg_record_selection(uuid,bigint,bigint);

create function public.wg_record_judged_selection(p_campaign uuid,p_participant uuid,p_decision jsonb) returns jsonb language plpgsql set search_path='' as $$
declare c public.wg_campaigns; total bigint; applications bigint; selected public.wg_entries; pool_hash text;
begin
  select * into c from public.wg_campaigns where id=p_campaign for update;
  if c.id is null or c.status<>'selection_pending' or c.end_at is null or c.end_at>now() or c.selection_mode<>'judged' or c.legal_approved_at is null or length(trim(c.selection_procedure))<10 or not public.wg_rules_complete(c.rules) then raise exception 'SELECTION_NOT_READY'; end if;
  if length(trim(coalesce(p_decision->>'rubric_version','')))<1 or length(trim(coalesce(p_decision->>'rationale','')))<10 or jsonb_typeof(p_decision->'reviewers') is distinct from 'array' then raise exception 'REVIEW_REQUIRED'; end if;
  if jsonb_array_length(p_decision->'reviewers')<1 or jsonb_array_length(p_decision->'reviewers')>20 or exists(select 1 from jsonb_array_elements(p_decision->'reviewers') r where jsonb_typeof(r)<>'string' or length(trim(r #>> '{}'))<2) then raise exception 'REVIEW_REQUIRED'; end if;
  lock table public.wg_entries in share mode;
  if exists(select 1 from public.wg_orders where campaign_id=p_campaign and status in ('pending','review','disputed')) then raise exception 'PAYMENT_RECONCILIATION_REQUIRED'; end if;
  select count(*),count(distinct participant_id),encode(sha256(convert_to(coalesce(string_agg(id::text,',' order by id),''),'UTF8')),'hex') into total,applications,pool_hash from public.wg_entries where campaign_id=p_campaign and status='valid';
  -- A valid free or paid entry admits the application; quantity supplies no automatic score.
  select * into selected from public.wg_entries where campaign_id=p_campaign and participant_id=p_participant and status='valid' order by id limit 1;
  if selected.id is null then raise exception 'INELIGIBLE_APPLICATION'; end if;
  insert into public.wg_winner_selections(campaign_id,entry_id,eligible_pool_count,eligible_application_count,pool_digest,algorithm_version,decision)
  values(p_campaign,selected.id,total,applications,pool_hash,'documented-team-review-v1',jsonb_build_object('rubric_version',p_decision->>'rubric_version','reviewers',p_decision->'reviewers','rationale',p_decision->>'rationale','published_procedure',c.selection_procedure,'rules_version',c.rules_version));
  update public.wg_campaigns set status='selected' where id=p_campaign;
  insert into public.wg_audit_logs(campaign_id,action,subject_id) values(p_campaign,'team_selection_recorded',selected.entry_number);
  return jsonb_build_object('entry_number',selected.entry_number,'eligible_pool_count',total,'eligible_application_count',applications,'pool_digest',pool_hash);
end; $$;
revoke all on function public.wg_record_judged_selection(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.wg_record_judged_selection(uuid,uuid,jsonb) to service_role;
