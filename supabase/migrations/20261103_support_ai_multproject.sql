-- Support AI additive migration: no changes to existing AGENT tables.
-- New support_* tables reuse organization membership and Supabase Auth.
create extension if not exists pgcrypto;
create table if not exists public.support_projects (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 2 and 120),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
 instructions text not null default 'أجب فقط من المعرفة المعتمدة، وإذا لم تجد المعلومة فاطلب التحويل لموظف.',
 created_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,slug)
);
create table if not exists public.support_documents (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 project_id uuid not null,
 title text not null check(char_length(title) between 1 and 200),
 content text not null check(char_length(content) between 1 and 200000),
 created_at timestamptz not null default now(),
 foreign key(organization_id,project_id) references public.support_projects(organization_id,id) on delete cascade,
 unique(organization_id,project_id,id)
);
create table if not exists public.support_widgets (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 project_id uuid not null,
 public_key text not null unique default encode(gen_random_bytes(24),'hex'),
 allowed_origin text not null check(allowed_origin ~ '^https://[^/]+$'),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key(organization_id,project_id) references public.support_projects(organization_id,id) on delete cascade
);
create table if not exists public.support_conversations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 project_id uuid not null,
 widget_id uuid references public.support_widgets(id) on delete set null,
 customer_token_hash text not null,
 mode text not null default 'ai' check(mode in ('ai','human')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,project_id,id),
 foreign key(organization_id,project_id) references public.support_projects(organization_id,id) on delete cascade
);
create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 project_id uuid not null,
 conversation_id uuid not null,
 role text not null check(role in ('customer','assistant','employee','system')),
 body text not null check(char_length(body) between 1 and 8000),
 created_at timestamptz not null default now(),
 foreign key(organization_id,project_id,conversation_id)
 references public.support_conversations(organization_id,project_id,id) on delete cascade
);
create index if not exists support_documents_lookup_idx on public.support_documents(organization_id,project_id);
create index if not exists support_conversations_recent_idx on public.support_conversations(organization_id,project_id,updated_at desc);
create index if not exists support_messages_recent_idx on public.support_messages(organization_id,project_id,conversation_id,created_at);
alter table public.support_projects enable row level security;
alter table public.support_documents enable row level security;
alter table public.support_widgets enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
-- Only members can read support data. Only admins/managers can modify project knowledge.
create policy support_projects_read on public.support_projects for select to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_projects.organization_id and m.user_id=(select auth.uid())));
create policy support_projects_admin_insert on public.support_projects for insert to authenticated
 with check(exists(select 1 from public.organization_members m where m.organization_id=support_projects.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy support_projects_admin_update on public.support_projects for update to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_projects.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')))
 with check(exists(select 1 from public.organization_members m where m.organization_id=support_projects.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy support_documents_read on public.support_documents for select to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_documents.organization_id and m.user_id=(select auth.uid())));
create policy support_documents_insert on public.support_documents for insert to authenticated
 with check(exists(select 1 from public.organization_members m where m.organization_id=support_documents.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy support_documents_delete on public.support_documents for delete to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_documents.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy support_widgets_read on public.support_widgets for select to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_widgets.organization_id and m.user_id=(select auth.uid())));
create policy support_widgets_insert on public.support_widgets for insert to authenticated
 with check(exists(select 1 from public.organization_members m where m.organization_id=support_widgets.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy support_widgets_update on public.support_widgets for update to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_widgets.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')))
 with check(exists(select 1 from public.organization_members m where m.organization_id=support_widgets.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy support_conversations_read on public.support_conversations for select to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_conversations.organization_id and m.user_id=(select auth.uid())));
create policy support_messages_read on public.support_messages for select to authenticated
 using(exists(select 1 from public.organization_members m where m.organization_id=support_messages.organization_id and m.user_id=(select auth.uid())));
revoke all on public.support_projects,public.support_documents,public.support_widgets,public.support_conversations,public.support_messages from anon,authenticated;
grant select on public.support_projects,public.support_documents,public.support_widgets,public.support_conversations,public.support_messages to authenticated;
grant insert,update(name,instructions) on public.support_projects to authenticated;
grant insert,delete on public.support_documents to authenticated;
grant insert,update(enabled) on public.support_widgets to authenticated;
-- No browser writes to conversations/messages. Public chat will require audited server endpoints.
