-- Index foreign keys used by the team inbox and assignment workflows.
-- Safe, non-destructive performance migration.
create index if not exists leads_assigned_to_idx
  on public.leads (assigned_to) where assigned_to is not null;
create index if not exists conversations_assigned_to_idx
  on public.conversations (assigned_to) where assigned_to is not null;
create index if not exists handoff_tasks_assigned_to_idx
  on public.handoff_tasks (assigned_to) where assigned_to is not null;
create index if not exists handoff_tasks_org_conversation_idx
  on public.handoff_tasks (organization_id, conversation_id);
create index if not exists handoff_tasks_org_lead_idx
  on public.handoff_tasks (organization_id, lead_id);
create index if not exists messages_org_conversation_created_idx
  on public.messages (organization_id, conversation_id, created_at);
