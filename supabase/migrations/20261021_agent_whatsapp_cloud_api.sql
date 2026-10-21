-- Official WhatsApp Business Cloud API integration for AGENT only.
-- TARGET Supabase project: gldlgdycgneadbqftcrj. No provider secrets stored here.
-- No outbound messages from any SQL function; external send is an explicit server action.

create table if not exists public.agent_whatsapp_channels (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.organizations(id) on delete cascade,
 phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,25}$'),
 display_name text not null default 'WhatsApp Business' check (char_length(display_name) between 2 and 120),
 enabled boolean not null default true,
 reply_mode text not null default 'draft' check (reply_mode in ('draft','auto')),
 welcome_text text not null default 'أهلاً بك، شكرًا لتواصلك معنا. كيف يمكننا مساعدتك؟'
    check (char_length(welcome_text) between 2 and 900),
 faq jsonb not null default '[]'::jsonb check (jsonb_typeof(faq)='array' and jsonb_array_length(faq)<=12),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists agent_whatsapp_channels_org_idx
 on public.agent_whatsapp_channels (organization_id);

create table if not exists public.agent_whatsapp_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 channel_id uuid not null references public.agent_whatsapp_channels(id) on delete cascade,
 conversation_id uuid not null,
 provider_message_id text not null check (char_length(provider_message_id) between 10 and 250),
 sender text not null check (sender ~ '^[0-9]{7,20}$'),
 received_at timestamptz not null,
 body text,
 status text not null default 'received'
  check (status in ('received','draft','human','sending','sent','failed')),
 draft_text text check (draft_text is null or char_length(draft_text) between 1 and 900),
 outbound_message_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (channel_id,provider_message_id),
 foreign key (organization_id,conversation_id)
  references public.conversations(organization_id,id) on delete cascade
);
create index if not exists agent_whatsapp_events_org_created_idx
 on public.agent_whatsapp_events(organization_id,created_at desc);
create index if not exists agent_whatsapp_events_pending_idx
 on public.agent_whatsapp_events(channel_id,status,created_at desc);

alter table public.agent_whatsapp_channels enable row level security;
alter table public.agent_whatsapp_events enable row level security;
revoke all on public.agent_whatsapp_channels,public.agent_whatsapp_events from anon,authenticated;
grant select on public.agent_whatsapp_channels,public.agent_whatsapp_events to authenticated;
grant insert,update on public.agent_whatsapp_channels to authenticated;

create policy agent_whatsapp_channels_manager_read on public.agent_whatsapp_channels
 for select to authenticated using (
 exists (select 1 from public.organization_members m
 where m.organization_id=agent_whatsapp_channels.organization_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy agent_whatsapp_channels_manager_insert on public.agent_whatsapp_channels
 for insert to authenticated with check (
 exists (select 1 from public.organization_members m
 where m.organization_id=agent_whatsapp_channels.organization_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy agent_whatsapp_channels_manager_update on public.agent_whatsapp_channels
 for update to authenticated using (
 exists (select 1 from public.organization_members m
 where m.organization_id=agent_whatsapp_channels.organization_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','manager')))
 with check (
 exists (select 1 from public.organization_members m
 where m.organization_id=agent_whatsapp_channels.organization_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));
create policy agent_whatsapp_events_manager_read on public.agent_whatsapp_events
 for select to authenticated using (
 exists (select 1 from public.organization_members m
 where m.organization_id=agent_whatsapp_events.organization_id
 and m.user_id=(select auth.uid()) and m.role in ('admin','manager')));

-- Only AGENT server with its scoped service credential can call these RPCs.
-- Database advisory lock makes incoming webhook retries and simultaneous messages idempotent.
create or replace function public.agent_whatsapp_receive(
 p_phone_number_id text,p_message_id text,p_sender text,
 p_name text,p_text text,p_timestamp bigint)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_channel public.agent_whatsapp_channels%rowtype;
 v_conversation uuid;v_lead uuid;v_event uuid;
begin
 if auth.role() is distinct from 'service_role'
 or p_phone_number_id !~ '^[0-9]{5,25}$'
 or p_sender !~ '^[0-9]{7,20}$'
 or p_message_id !~ '^wamid\.[A-Za-z0-9._=-]{5,230}$'
 or p_timestamp < 1 or p_timestamp > extract(epoch from now()+interval '5 minutes')::bigint
 or pg_catalog.char_length(coalesce(p_name,'')) > 100
 or pg_catalog.char_length(coalesce(p_text,'')) > 3000 then
  raise exception 'INVALID_WHATSAPP_EVENT' using errcode='22023';
 end if;
 select * into v_channel from public.agent_whatsapp_channels
  where phone_number_id=p_phone_number_id and enabled=true;
 if not found then return pg_catalog.jsonb_build_object('ignored',true);end if;
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(p_phone_number_id||':'||p_sender,28021));
 select id into v_event from public.agent_whatsapp_events
  where channel_id=v_channel.id and provider_message_id=p_message_id;
 if v_event is not null then
  return pg_catalog.jsonb_build_object('duplicate',true);
 end if;
 select id,lead_id into v_conversation,v_lead
 from public.conversations
 where organization_id=v_channel.organization_id and channel='whatsapp'
  and external_thread_id=p_phone_number_id||':'||p_sender limit 1;
 if v_conversation is null then
  insert into public.leads(organization_id,full_name,phone,source,business_type)
   values(v_channel.organization_id,coalesce(nullif(pg_catalog.btrim(p_name),''),'عميل واتساب'),
    p_sender,'whatsapp','other') returning id into v_lead;
  insert into public.conversations
   (organization_id,lead_id,channel,external_thread_id,mode,last_message_at)
   values(v_channel.organization_id,v_lead,'whatsapp',p_phone_number_id||':'||p_sender,
    'ai',now()) returning id into v_conversation;
 end if;
 insert into public.messages
  (organization_id,conversation_id,direction,author_type,body,external_message_id)
 values(v_channel.organization_id,v_conversation,'incoming','customer',
    coalesce(nullif(p_text,''),'[رسالة غير نصية]'),p_message_id);
 update public.conversations set last_message_at=now()
 where id=v_conversation and organization_id=v_channel.organization_id;
 insert into public.agent_whatsapp_events
 (organization_id,channel_id,conversation_id,provider_message_id,sender,received_at,body)
 values (v_channel.organization_id,v_channel.id,v_conversation,p_message_id,p_sender,
  pg_catalog.to_timestamp(p_timestamp),p_text)
 returning id into v_event;
 return pg_catalog.jsonb_build_object('event_id',v_event,
  'conversation_id',v_conversation,'channel_id',v_channel.id,
  'organization_id',v_channel.organization_id,'conversation_mode',
  (select mode from public.conversations where id=v_conversation),
  'reply_mode',v_channel.reply_mode,'faq',v_channel.faq,'welcome',v_channel.welcome_text);
end;$$;

create or replace function public.agent_whatsapp_mark(
 p_event_id uuid,p_status text,p_reply text default null)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_event public.agent_whatsapp_events%rowtype;
begin
 if auth.role() is distinct from 'service_role'
  or p_status not in ('draft','human','sending','failed')
  or (p_status in ('draft','sending') and
      (p_reply is null or pg_catalog.char_length(p_reply) not between 1 and 900))
 then raise exception 'INVALID_WHATSAPP_STATUS' using errcode='22023';end if;
 select * into v_event from public.agent_whatsapp_events
 where id=p_event_id and status='received' for update;
 if not found then return false;end if;
 if p_status='sending' and not exists (
  select 1 from public.agent_whatsapp_channels c
  join public.conversations v on v.id=v_event.conversation_id
  where c.id=v_event.channel_id and c.enabled and c.reply_mode='auto'
   and v.mode='ai' and v_event.received_at>=now()-interval '23 hours 59 minutes'
 ) then return false;end if;
 update public.agent_whatsapp_events
 set status=p_status,draft_text=case when p_status in ('draft','sending') then p_reply else null end,
 updated_at=now() where id=p_event_id;
 return true;
end;$$;

create or replace function public.agent_whatsapp_finish(
 p_event_id uuid,p_outbound_id text,p_success boolean)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_event public.agent_whatsapp_events%rowtype;
begin
 if auth.role() is distinct from 'service_role'
 or p_success is null or (p_success and
  (p_outbound_id is null or pg_catalog.char_length(p_outbound_id) not between 8 and 250))
 then raise exception 'INVALID_WHATSAPP_SEND_RESULT' using errcode='22023';end if;
 select * into v_event from public.agent_whatsapp_events
 where id=p_event_id and status='sending' for update;
 if not found then return false;end if;
 update public.agent_whatsapp_events set
 status=case when p_success then 'sent' else 'failed' end,
 outbound_message_id=case when p_success then p_outbound_id else null end,
 updated_at=now() where id=p_event_id;
 if p_success then
  insert into public.messages
   (organization_id,conversation_id,direction,author_type,body,external_message_id)
   values(v_event.organization_id,v_event.conversation_id,'outgoing','ai',
    v_event.draft_text,p_outbound_id);
  update public.conversations set last_message_at=now()
   where id=v_event.conversation_id and organization_id=v_event.organization_id;
 end if;
 return true;
end;$$;

create or replace function public.agent_whatsapp_handoff(p_event_id uuid,p_reason text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_event public.agent_whatsapp_events%rowtype;v_lead uuid;
begin
 if auth.role() is distinct from 'service_role'
 or pg_catalog.char_length(coalesce(p_reason,'')) not between 2 and 200
 then raise exception 'INVALID_WHATSAPP_HANDOFF' using errcode='22023';end if;
 select * into v_event from public.agent_whatsapp_events
 where id=p_event_id and status='received' for update;
 if not found then return false;end if;
 select lead_id into v_lead from public.conversations
 where id=v_event.conversation_id and organization_id=v_event.organization_id
 for update;
 update public.conversations set mode='human'
 where id=v_event.conversation_id and organization_id=v_event.organization_id;
 if not exists (select 1 from public.handoff_tasks
 where conversation_id=v_event.conversation_id
  and organization_id=v_event.organization_id
  and handoff_type='chat' and status in ('pending','in_progress')) then
  insert into public.handoff_tasks
   (organization_id,lead_id,conversation_id,handoff_type,summary)
  values (v_event.organization_id,v_lead,v_event.conversation_id,'chat',
   pg_catalog.left(p_reason,200));
 end if;
 update public.agent_whatsapp_events set status='human',updated_at=now()
 where id=p_event_id;
 return true;
end;$$;

revoke all on function public.agent_whatsapp_receive(text,text,text,text,text,bigint) from public,anon,authenticated;
revoke all on function public.agent_whatsapp_mark(uuid,text,text) from public,anon,authenticated;
revoke all on function public.agent_whatsapp_finish(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.agent_whatsapp_handoff(uuid,text) from public,anon,authenticated;
grant execute on function public.agent_whatsapp_receive(text,text,text,text,text,bigint) to service_role;
grant execute on function public.agent_whatsapp_mark(uuid,text,text) to service_role;
grant execute on function public.agent_whatsapp_finish(uuid,text,boolean) to service_role;
grant execute on function public.agent_whatsapp_handoff(uuid,text) to service_role;
