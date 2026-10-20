-- AGENT-specific evidence ledger, not model fine-tuning or credential storage.
-- An outcome describes user feedback or sandbox process execution, never
-- verifies the factual correctness of a generated answer automatically.
create table if not exists public.assistant_experience_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reply_feedback','sandbox_execution')),
  reference_id uuid not null,
  task_domain text not null check (task_domain in
    ('coding','writing','marketing','analysis','research','planning','general')),
  model text not null check (char_length(model) between 2 and 180),
  outcome text not null check (outcome in ('positive','negative')),
  evidence text not null default '' check (char_length(evidence)<=200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,user_id,kind,reference_id)
);
create index if not exists assistant_experience_personal_models on
  public.assistant_experience_events (organization_id,user_id,task_domain,created_at desc);
alter table public.assistant_experience_events enable row level security;
create policy agent_experience_read_self on public.assistant_experience_events
  for select to authenticated using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_experience_events.organization_id
        and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
create policy agent_experience_insert_self on public.assistant_experience_events
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_experience_events.organization_id
        and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
create policy agent_experience_update_self on public.assistant_experience_events
  for update to authenticated using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_experience_events.organization_id
        and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  ) with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_experience_events.organization_id
        and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
revoke all on public.assistant_experience_events from anon,authenticated;
grant select,insert,update on public.assistant_experience_events to authenticated;
