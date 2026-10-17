-- Initial schema for the independent sales agent.
-- Do not apply to other Supabase projects. Target: gldlgdycgneadbqftcrj
-- No secrets, test data, or access keys belong in migrations.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'sales', 'engineer')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx
  on public.organization_members (user_id, organization_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  business_name text,
  business_type text not null default 'other'
    check (business_type in ('restaurant', 'cafe', 'clothing_store', 'clothing_factory', 'other')),
  source text not null default 'manual'
    check (source in ('whatsapp', 'messenger', 'facebook_comment', 'manual')),
  stage text not null default 'new'
    check (stage in ('new', 'qualifying', 'qualified', 'contacting', 'site_visit', 'proposal', 'won', 'lost')),
  priority text not null default 'warm'
    check (priority in ('hot', 'warm', 'cold')),
  preferred_contact text not null default 'chat'
    check (preferred_contact in ('chat', 'phone', 'either')),
  assigned_to uuid references auth.users(id) on delete set null,
  qualification jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index leads_org_stage_idx on public.leads (organization_id, stage, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'messenger', 'facebook_comment')),
  external_thread_id text,
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, channel, external_thread_id),
  foreign key (organization_id, lead_id)
    references public.leads (organization_id, id) on delete cascade
);

create index conversations_lead_idx on public.conversations (organization_id, lead_id);
create index conversations_recent_idx on public.conversations (organization_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  direction text not null check (direction in ('incoming', 'outgoing', 'internal')),
  author_type text not null check (author_type in ('customer', 'ai', 'employee', 'system')),
  body text not null,
  external_message_id text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);

create index messages_thread_idx on public.messages (conversation_id, created_at);

create table public.handoff_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null,
  conversation_id uuid,
  handoff_type text not null check (handoff_type in ('chat', 'call', 'site_visit')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  summary text not null default '',
  requested_time timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, lead_id)
    references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete set null (conversation_id)
);

create index handoff_queue_idx on public.handoff_tasks
  (organization_id, status, created_at desc);

-- RLS: authenticated users can read only their own organization data.
-- Memberships are provisioned by trusted backend/admin logic, not public clients.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.handoff_tasks enable row level security;

create policy members_self_read on public.organization_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy organizations_team_read on public.organizations
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
  ));

create policy leads_team_read on public.leads
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = leads.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy leads_sales_insert on public.leads
  for insert to authenticated
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = leads.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ));

create policy leads_sales_update on public.leads
  for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = leads.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = leads.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ));

create policy conversations_team_read on public.conversations
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = conversations.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy conversations_sales_insert on public.conversations
  for insert to authenticated
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = conversations.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ));

create policy conversations_sales_update on public.conversations
  for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = conversations.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = conversations.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ));

create policy messages_team_read on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = messages.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy handoffs_team_read on public.handoff_tasks
  for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = handoff_tasks.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy handoffs_sales_insert on public.handoff_tasks
  for insert to authenticated
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = handoff_tasks.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ));

create policy handoffs_sales_update on public.handoff_tasks
  for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = handoff_tasks.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = handoff_tasks.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'manager', 'sales')
  ));

-- Restrict exposed Data API table privileges. RLS is additional protection.
revoke all on public.organizations, public.organization_members, public.leads,
  public.conversations, public.messages, public.handoff_tasks from anon, authenticated;

grant select on public.organizations, public.organization_members, public.leads,
  public.conversations, public.messages, public.handoff_tasks to authenticated;
grant insert, update on public.leads, public.conversations, public.handoff_tasks to authenticated;

-- Message creation and sensitive membership changes belong in audited server endpoints.
-- No authenticated INSERT/UPDATE/DELETE grants on public.messages.
-- Deliberately no DELETE grants on customer, thread, or task records.
