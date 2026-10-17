-- Internal inbox first: manual follow-up records, not externally sent messages.
-- Target project: gldlgdycgneadbqftcrj. Do not apply on another project.

alter table public.conversations
  drop constraint if exists conversations_channel_check;
alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('whatsapp', 'messenger', 'facebook_comment', 'manual'));

-- Only one internal thread per customer per organization.
create unique index if not exists conversations_manual_lead_unique
  on public.conversations (organization_id, lead_id) where channel = 'manual';

-- Do not let browser clients manufacture an external provider conversation
-- or change AI/human mode by updating arbitrary rows.
revoke insert, update on public.conversations from authenticated;

create or replace function public.create_internal_thread(p_lead_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_thread_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select l.organization_id into v_org_id
  from public.leads as l
  join public.organization_members as m
    on m.organization_id = l.organization_id
   and m.user_id = auth.uid()
   and m.role in ('admin', 'manager', 'sales')
  where l.id = p_lead_id;

  if v_org_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.conversations
    (organization_id, lead_id, channel, mode, assigned_to)
  values (v_org_id, p_lead_id, 'manual', 'human', auth.uid())
  on conflict (organization_id, lead_id) where channel = 'manual' do nothing
  returning id into v_thread_id;

  if v_thread_id is null then
    select id into v_thread_id from public.conversations
    where organization_id = v_org_id and lead_id = p_lead_id and channel = 'manual';
  end if;
  return v_thread_id;
end;
$$;

-- Never send to a provider from this function. The note is INTERNAL only.
create or replace function public.add_internal_note(p_conversation_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_message_id uuid;
  v_clean_body text;
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_clean_body := pg_catalog.btrim(coalesce(p_body, ''));
  if pg_catalog.char_length(v_clean_body) < 1
    or pg_catalog.char_length(v_clean_body) > 2000 then
    raise exception 'Note must contain 1 to 2000 characters' using errcode = '22023';
  end if;

  select c.organization_id into v_org_id
  from public.conversations as c
  join public.organization_members as m
    on m.organization_id = c.organization_id
   and m.user_id = auth.uid()
   and m.role in ('admin', 'manager', 'sales')
  where c.id = p_conversation_id;

  if v_org_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.messages
    (organization_id, conversation_id, direction, author_type, body)
  values (v_org_id, p_conversation_id, 'internal', 'employee', v_clean_body)
  returning id into v_message_id;

  update public.conversations set last_message_at = now()
    where id = p_conversation_id and organization_id = v_org_id;

  return v_message_id;
end;
$$;

-- Taking over an external conversation and creating the handoff task
-- happens in one transaction. No AI auto-restart in this function.
create or replace function public.takeover_conversation(
  p_conversation_id uuid,
  p_handoff_type text default 'chat',
  p_summary text default ''
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_lead_id uuid;
  v_task_id uuid;
begin
  if auth.uid() is null or p_handoff_type not in ('chat', 'call', 'site_visit') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if pg_catalog.char_length(coalesce(p_summary, '')) > 2000 then
    raise exception 'Summary is too long' using errcode = '22023';
  end if;

  select c.organization_id, c.lead_id into v_org_id, v_lead_id
  from public.conversations as c
  join public.organization_members as m
    on m.organization_id = c.organization_id
   and m.user_id = auth.uid()
   and m.role in ('admin', 'manager', 'sales')
  where c.id = p_conversation_id
  for update of c;

  if v_org_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.conversations
    set mode = 'human', assigned_to = auth.uid()
    where id = p_conversation_id and organization_id = v_org_id;

  select id into v_task_id from public.handoff_tasks
    where organization_id = v_org_id
      and conversation_id = p_conversation_id
      and handoff_type = p_handoff_type
      and status in ('pending', 'in_progress')
    order by created_at desc
    limit 1;

  if v_task_id is null then
    insert into public.handoff_tasks
      (organization_id, conversation_id, lead_id, handoff_type, assigned_to, summary)
    values
      (v_org_id, p_conversation_id, v_lead_id, p_handoff_type,
       auth.uid(), coalesce(p_summary, ''))
    returning id into v_task_id;
  end if;

  return v_task_id;
end;
$$;

revoke all on function public.create_internal_thread(uuid) from public, anon;
revoke all on function public.add_internal_note(uuid, text) from public, anon;
revoke all on function public.takeover_conversation(uuid, text, text) from public, anon;

grant execute on function public.create_internal_thread(uuid) to authenticated;
grant execute on function public.add_internal_note(uuid, text) to authenticated;
grant execute on function public.takeover_conversation(uuid, text, text) to authenticated;
