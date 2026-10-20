-- AGENT private artifact library. Does not touch Premier.OS or marketing creatives.
create table if not exists public.assistant_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid null references public.assistant_threads(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 8388608),
  kind text not null check (kind in ('document','image','audio','video','other')),
  source text not null check (source in ('upload','assistant')),
  created_at timestamptz not null default now()
);
create index if not exists assistant_library_user_recent
  on public.assistant_library_items (organization_id,user_id,created_at desc);
alter table public.assistant_library_items enable row level security;
create policy library_self_read on public.assistant_library_items
  for select to authenticated using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_library_items.organization_id
        and m.user_id=(select auth.uid())
    )
  );
create policy library_self_insert on public.assistant_library_items
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_library_items.organization_id
        and m.user_id=(select auth.uid())
        and m.role in ('admin','manager')
    )
    and split_part(storage_path,'/',1)=organization_id::text
    and split_part(storage_path,'/',2)=user_id::text
  );
create policy library_self_delete on public.assistant_library_items
  for delete to authenticated using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.organization_members m
      where m.organization_id=assistant_library_items.organization_id
        and m.user_id=(select auth.uid())
        and m.role in ('admin','manager')
    )
  );
revoke all on public.assistant_library_items from anon,authenticated;
grant select,insert,delete on public.assistant_library_items to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('agent-library','agent-library',false,8388608,array[
  'text/plain','text/markdown','text/csv','application/json','application/pdf',
  'image/png','image/jpeg','image/webp','image/gif',
  'audio/mpeg','audio/wav','audio/ogg','video/mp4','video/webm'
])
on conflict (id) do nothing;

-- Every stored object belongs to exactly one organization and its uploader.
create policy agent_library_objects_select on storage.objects
  for select to authenticated using (
    bucket_id='agent-library'
    and (storage.foldername(name))[2]=(select auth.uid())::text
    and exists (
      select 1 from public.organization_members m
      where m.organization_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid())
    )
  );
create policy agent_library_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id='agent-library'
    and (storage.foldername(name))[2]=(select auth.uid())::text
    and exists (
      select 1 from public.organization_members m
      where m.organization_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
create policy agent_library_objects_delete on storage.objects
  for delete to authenticated using (
    bucket_id='agent-library'
    and (storage.foldername(name))[2]=(select auth.uid())::text
    and exists (
      select 1 from public.organization_members m
      where m.organization_id::text=(storage.foldername(name))[1]
        and m.user_id=(select auth.uid()) and m.role in ('admin','manager')
    )
  );
