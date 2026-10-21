-- AGENT-only durable planning quota. Two planning attempts per owner per 10 minutes.
-- Additive: no existing rows or production tables are overwritten.
create table if not exists public.assistant_project_plan_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.assistant_threads(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists agent_project_plan_attempts_owner_window
 on public.assistant_project_plan_attempts (user_id,created_at desc);
alter table public.assistant_project_plan_attempts enable row level security;
revoke all on public.assistant_project_plan_attempts from anon,authenticated;
grant select on public.assistant_project_plan_attempts to authenticated;
create policy agent_project_plan_attempts_owner_read on public.assistant_project_plan_attempts
 for select to authenticated using (
  user_id=(select auth.uid()) and exists (
   select 1 from public.organization_members m
   where m.organization_id=assistant_project_plan_attempts.organization_id
    and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
  )
 );
create or replace function public.claim_agent_project_plan_slot(p_organization_id uuid,p_thread_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then return false;end if;
 if not exists (
  select 1 from public.organization_members m
  join public.assistant_threads t on t.organization_id=m.organization_id
  where m.organization_id=p_organization_id and m.user_id=v_user
    and m.role in ('admin','manager')
    and t.id=p_thread_id and t.user_id=v_user
 ) then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,41118));
 if (select count(*) from public.assistant_project_plan_attempts
     where user_id=v_user and created_at>now()-interval '10 minutes')>=2
  then return false;end if;
 insert into public.assistant_project_plan_attempts(organization_id,user_id,thread_id)
 values (p_organization_id,v_user,p_thread_id);
 return true;
end; $$;
revoke all on function public.claim_agent_project_plan_slot(uuid,uuid) from public,anon;
grant execute on function public.claim_agent_project_plan_slot(uuid,uuid) to authenticated;
