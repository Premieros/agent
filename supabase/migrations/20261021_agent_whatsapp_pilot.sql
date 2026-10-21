-- AGENT only: secure WhatsApp Cloud API pilot. Target Supabase project:
-- gldlgdycgneadbqftcrj. No other database, provider or phone is modified.
-- Inbound-only until all owner-provided Meta credentials and explicit send flag exist.
create table if not exists public.agent_whatsapp_pilot_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null,
 external_message_id text not null check (char_length(external_message_id) between 12 and 250),
 sender text not null check (char_length(sender) between 7 and 20),
 reply_state text not null default 'none'
  check (reply_state in ('none','sending','sent','failed')),
 reply_external_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,external_message_id),
 foreign key (organization_id,conversation_id)
  references public.conversations(organization_id,id) on delete cascade
);
create index if not exists agent_whatsapp_pilot_recent
 on public.agent_whatsapp_pilot_events(organization_id,created_at desc);
alter table public.agent_whatsapp_pilot_events enable row level security;
revoke all on public.agent_whatsapp_pilot_events from anon,authenticated;
-- Only the dedicated AGENT backend service role may write the pilot table.

create or replace function public.agent_claim_whatsapp_incoming(
 p_organization_id uuid,p_message_id text,p_sender text,
 p_customer_name text,p_body text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_lead uuid;
 v_thread uuid;
 v_rule boolean := false;
 v_trigger text := '#مساعد';
 v_mode text;
begin
 if p_organization_id is null or p_message_id !~ '^wamid\.[a-zA-Z0-9._=-]{5,230}$'
   or p_sender !~ '^[0-9]{7,20}$' or
   p_body is null or pg_catalog.char_length(p_body)>3100 then
   raise exception 'INVALID_WHATSAPP_MESSAGE' using errcode='22023';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(p_organization_id::text||':'||p_sender,93701));
 if exists(select 1 from public.agent_whatsapp_pilot_events
   where organization_id=p_organization_id and external_message_id=p_message_id)
 then return pg_catalog.jsonb_build_object('claimed',false); end if;

 select c.id,c.lead_id,c.mode into v_thread,v_lead,v_mode
 from public.conversations c
 where c.organization_id=p_organization_id and c.channel='whatsapp'
   and c.external_thread_id=p_sender
 limit 1 for update;

 if v_thread is null then
   select l.id into v_lead from public.leads l
   where l.organization_id=p_organization_id and l.phone=p_sender
   order by l.created_at limit 1;
   if v_lead is null then
    insert into public.leads(organization_id,full_name,phone,source,business_type)
     values(p_organization_id,
      pg_catalog.left(coalesce(
       nullif(pg_catalog.btrim(p_customer_name),''),'عميل واتساب'),100),
      p_sender,'whatsapp','other') returning id into v_lead;
   end if;
   insert into public.conversations
     (organization_id,lead_id,channel,external_thread_id,mode)
     values(p_organization_id,v_lead,'whatsapp',p_sender,'ai')
     returning id,mode into v_thread,v_mode;
 end if;

 insert into public.messages(
  organization_id,conversation_id,direction,author_type,body,external_message_id
 ) values(p_organization_id,v_thread,'incoming','customer',
  pg_catalog.left(p_body,3100),p_message_id);
 insert into public.agent_whatsapp_pilot_events
  (organization_id,conversation_id,external_message_id,sender)
 values(p_organization_id,v_thread,p_message_id,p_sender);
 update public.conversations set last_message_at=pg_catalog.now()
  where id=v_thread and organization_id=p_organization_id;
 select r.enabled,r.trigger_phrase into v_rule,v_trigger
 from public.agent_reply_rules r
 where r.organization_id=p_organization_id;
 return pg_catalog.jsonb_build_object('claimed',true,'conversation_id',v_thread,
  'mode',v_mode,'keyword_enabled',coalesce(v_rule,false),
  'keyword',coalesce(v_trigger,'#مساعد'));
end;
$$;
revoke all on function public.agent_claim_whatsapp_incoming(uuid,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.agent_claim_whatsapp_incoming(uuid,text,text,text,text)
 to service_role;
