-- Final decisions must retain a meaningful published evaluation procedure.
alter table public.wg_campaigns add constraint wg_judged_procedure_required
check (selection_mode <> 'judged' or status not in ('selection_pending','selected','completed') or coalesce(length(trim(selection_procedure)),0)>=10);
