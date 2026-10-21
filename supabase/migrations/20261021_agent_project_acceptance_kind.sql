-- AGENT project builder: preserve independently chosen acceptance requirements.
-- Additive, existing projects remain "none" until independently reviewed.
alter table public.assistant_project_builds
  add column if not exists acceptance_kind text not null default 'none';
do $$
begin
 if not exists(select 1 from pg_constraint where conname='agent_project_acceptance_kind_ck'
  and conrelid='public.assistant_project_builds'::regclass) then
  alter table public.assistant_project_builds
   add constraint agent_project_acceptance_kind_ck
   check (acceptance_kind in ('none','inventory','task_board'));
 end if;
end $$;
