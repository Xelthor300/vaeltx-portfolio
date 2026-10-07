alter table public.va_projects
  add column if not exists original_client_request text,
  add column if not exists request_capture_mode text not null default 'unknown',
  add column if not exists request_source text,
  add column if not exists request_source_url text,
  add column if not exists problem_opportunity text,
  add column if not exists exclusions jsonb not null default '[]'::jsonb,
  add column if not exists client_promises jsonb not null default '[]'::jsonb,
  add column if not exists vaeltx_promises jsonb not null default '[]'::jsonb,
  add column if not exists delivery_instructions text,
  add column if not exists approval_evidence text,
  add column if not exists approved_at timestamptz,
  add column if not exists scope_locked_at timestamptz,
  add column if not exists scope_locked_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists scope_revision integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'va_projects_request_capture_mode_check'
      and conrelid = 'public.va_projects'::regclass
  ) then
    alter table public.va_projects
      add constraint va_projects_request_capture_mode_check
      check (request_capture_mode in ('unknown','verbatim','faithful_summary'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'va_projects_scope_revision_check'
      and conrelid = 'public.va_projects'::regclass
  ) then
    alter table public.va_projects
      add constraint va_projects_scope_revision_check
      check (scope_revision >= 0);
  end if;
end $$;

comment on column public.va_projects.original_client_request is
  'Original client request captured verbatim where possible, otherwise a faithful summary.';

comment on column public.va_projects.scope_locked_snapshot is
  'Immutable internal snapshot of the agreed commercial/operational scope at the time scope was locked.';
