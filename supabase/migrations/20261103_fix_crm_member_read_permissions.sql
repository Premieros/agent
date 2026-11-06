-- Fix AGENT CRM membership reads (PostgREST 42501).
-- Run in Supabase SQL Editor for project gldlgdycgneadbqftcrj.
-- No membership rows, passwords, or customer records are modified.
begin;
grant usage on schema public to authenticated;
grant select on table public.organization_members to authenticated;
alter table public.organization_members enable row level security;
do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='organization_members'
      and policyname='members_self_read'
  ) then
    create policy members_self_read
      on public.organization_members
      for select to authenticated
      using(user_id = (select auth.uid()));
  end if;
end $$;
commit;

-- Verify privileges and row level security. Both privileges must be true.
select
  has_schema_privilege('authenticated','public','USAGE') as schema_usage,
  has_table_privilege('authenticated','public.organization_members','SELECT') as membership_select,
  c.relrowsecurity as rls_enabled,
  exists(
    select 1 from pg_policies p where p.schemaname='public'
      and p.tablename='organization_members' and p.policyname='members_self_read'
  ) as membership_policy_present
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='organization_members';
