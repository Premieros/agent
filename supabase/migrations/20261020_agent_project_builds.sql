-- Independent multi-file project builder. Schema only; NEVER run this migration
-- without explicit approval. No AGENT source edits, GitHub pushes, or deployments.
create table if not exists public.assistant_project_builds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  task text not null check (char_length(task) between 2 and 4500),
  title text not null default '',
  steps jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check
    (status in ('planned','ready','testing','repairing','completed','failed')),
  approved_at timestamptz,
  deadline_at timestamptz,
  max_attempts integer not null default 2 check(max_attempts between 1 and 2),
  attempts integer not null default 0 check(attempts between 0 and 2),
  model_calls integer not null default 1 check(model_calls between 1 and 2),
  model text not null default '',
  execution_log text not null default '',
  stage_note text not null default '',
  test_passed boolean,
  saved_artifact_id uuid references public.assistant_library_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_project_attempt_bound check(attempts<=max_attempts)
);
create index if not exists assistant_project_owner_history on
  public.assistant_project_builds (organization_id,user_id,thread_id,created_at desc);
alter table public.assistant_project_builds enable row level security;
create policy agent_projects_owner_read on public.assistant_project_builds
  for select to authenticated using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_project_builds.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
create policy agent_projects_owner_insert on public.assistant_project_builds
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_project_builds.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
create policy agent_projects_owner_update on public.assistant_project_builds
  for update to authenticated using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_project_builds.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  ) with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_project_builds.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
revoke all on public.assistant_project_builds from anon,authenticated;
grant select,insert,update on public.assistant_project_builds to authenticated;

-- The existing private library already supports kind='other'. Allow ZIP files
-- in the existing AGENT bucket, without creating a new public bucket.
update storage.buckets
set allowed_mime_types=array_append(allowed_mime_types,'application/zip')
where id='agent-library' and allowed_mime_types is not null
  and not ('application/zip'=any(allowed_mime_types));
