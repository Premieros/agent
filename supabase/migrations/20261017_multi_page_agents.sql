-- Multi-page AI marketing studio, scoped to the same independent organization.
-- Work is drafted and reviewed; no provider credentials, auto-posts or ad spend.

create table public.marketing_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  platform text not null check (platform in ('facebook','instagram')),
  product_context text not null default '' check (char_length(product_context) <= 4000),
  target_audience text not null default '' check (char_length(target_audience) <= 2000),
  brand_voice text not null default 'احترافي وواضح' check (char_length(brand_voice) <= 500),
  -- External connection is not asserted by manual page creation.
  meta_page_id text,
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected','connected','expired')),
  created_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index marketing_pages_org_idx on public.marketing_pages(organization_id,created_at desc);

create table public.agent_missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null,
  objective text not null check (objective in ('content','campaign','replies','launch')),
  brief text not null check (char_length(btrim(brief)) between 10 and 5000),
  budget_egp numeric(12,2) check (budget_egp is null or (budget_egp >= 0 and budget_egp <= 100000000)),
  status text not null default 'queued'
    check (status in ('queued','running','review','approved','failed')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,page_id)
    references public.marketing_pages (organization_id,id) on delete cascade
);
create index agent_missions_org_idx on public.agent_missions(organization_id,created_at desc);
create index agent_missions_page_idx on public.agent_missions(organization_id,page_id,created_at desc);
create index agent_missions_creator_idx on public.agent_missions(requested_by);

create table public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null,
  agent_role text not null check (agent_role in
    ('director','strategist','copywriter','designer','media_buyer','support','reviewer')),
  content text not null check (char_length(content) between 1 and 30000),
  model text not null default '',
  created_at timestamptz not null default now(),
  unique (mission_id,agent_role),
  foreign key (organization_id,mission_id)
    references public.agent_missions(organization_id,id) on delete cascade
);
create index agent_outputs_org_mission_idx on public.agent_outputs(organization_id,mission_id);

create table public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mission_id uuid not null,
  storage_path text not null unique,
  prompt text not null check (char_length(prompt) <= 5000),
  created_at timestamptz not null default now(),
  foreign key (organization_id,mission_id)
    references public.agent_missions(organization_id,id) on delete cascade
);
create index creative_assets_org_mission_idx on public.creative_assets(organization_id,mission_id);

alter table public.marketing_pages enable row level security;
alter table public.agent_missions enable row level security;
alter table public.agent_outputs enable row level security;
alter table public.creative_assets enable row level security;

create policy marketing_pages_read on public.marketing_pages
  for select to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=marketing_pages.organization_id
      and m.user_id=(select auth.uid())));
create policy marketing_pages_insert on public.marketing_pages
  for insert to authenticated
  with check (exists (select 1 from public.organization_members m
    where m.organization_id=marketing_pages.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy marketing_pages_update on public.marketing_pages
  for update to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=marketing_pages.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')))
  with check (exists (select 1 from public.organization_members m
    where m.organization_id=marketing_pages.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));

create policy agent_missions_read on public.agent_missions
  for select to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=agent_missions.organization_id
      and m.user_id=(select auth.uid())));
create policy agent_missions_insert on public.agent_missions
  for insert to authenticated
  with check (requested_by=(select auth.uid())
    and exists (select 1 from public.organization_members m
    where m.organization_id=agent_missions.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy agent_missions_update on public.agent_missions
  for update to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=agent_missions.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')))
  with check (exists (select 1 from public.organization_members m
    where m.organization_id=agent_missions.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));

create policy agent_outputs_read on public.agent_outputs
  for select to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=agent_outputs.organization_id
      and m.user_id=(select auth.uid())));
create policy agent_outputs_insert on public.agent_outputs
  for insert to authenticated
  with check (exists (select 1 from public.organization_members m
    where m.organization_id=agent_outputs.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy agent_outputs_update on public.agent_outputs
  for update to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=agent_outputs.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')))
  with check (exists (select 1 from public.organization_members m
    where m.organization_id=agent_outputs.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));

create policy creative_assets_read on public.creative_assets
  for select to authenticated
  using (exists (select 1 from public.organization_members m
    where m.organization_id=creative_assets.organization_id
      and m.user_id=(select auth.uid())));
create policy creative_assets_insert on public.creative_assets
  for insert to authenticated
  with check (exists (select 1 from public.organization_members m
    where m.organization_id=creative_assets.organization_id
      and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));

revoke all on public.marketing_pages, public.agent_missions, public.agent_outputs, public.creative_assets
  from anon, authenticated;
grant select on public.marketing_pages, public.agent_missions, public.agent_outputs, public.creative_assets
  to authenticated;
grant insert (organization_id,name,platform,product_context,target_audience,brand_voice)
  on public.marketing_pages to authenticated;
grant update (name,product_context,target_audience,brand_voice)
  on public.marketing_pages to authenticated;
grant insert (organization_id,page_id,objective,brief,budget_egp,requested_by)
  on public.agent_missions to authenticated;
grant update (status) on public.agent_missions to authenticated;
grant insert (organization_id,mission_id,agent_role,content,model)
  on public.agent_outputs to authenticated;
grant update (content,model) on public.agent_outputs to authenticated;
grant insert (organization_id,mission_id,storage_path,prompt)
  on public.creative_assets to authenticated;

-- Private generated images; only a signed-in member of the owning company
-- may read them, and only an admin/manager may upload.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
  values ('marketing-creatives','marketing-creatives',false,10485760,array['image/png','image/jpeg','image/webp'])
  on conflict (id) do nothing;

create policy marketing_creatives_read on storage.objects
  for select to authenticated
  using (bucket_id='marketing-creatives' and exists (
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.organization_id::text = split_part(name,'/',1)
  ));
create policy marketing_creatives_upload on storage.objects
  for insert to authenticated
  with check (bucket_id='marketing-creatives' and exists (
    select 1 from public.organization_members m
    where m.user_id=(select auth.uid()) and m.role in ('admin','manager')
      and m.organization_id::text = split_part(name,'/',1)
  ));
