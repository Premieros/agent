-- Desktop companion: no direct client access. Apply only after reviewing on staging.
create table if not exists public.agent_desktop_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
create index if not exists agent_desktop_devices_owner_idx on public.agent_desktop_devices(organization_id,user_id);
alter table public.agent_desktop_devices enable row level security;
revoke all on public.agent_desktop_devices from anon, authenticated;
-- All device operations use authenticated server routes; never expose token hashes through Data API.

create table if not exists public.agent_desktop_jobs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.agent_desktop_devices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('open_url','click','type_text','hotkey')),
  arguments jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','rejected','failed')),
  result text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists agent_desktop_jobs_queue_idx on public.agent_desktop_jobs(device_id,status,created_at);
alter table public.agent_desktop_jobs enable row level security;
revoke all on public.agent_desktop_jobs from anon, authenticated;
-- Admin-only service API validates ownership and uses server-side service role. No public RLS grants.
