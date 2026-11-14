# AGENT — Customer Service Only

AGENT is now scoped to authenticated customer service operations: lead/customer records, internal conversations and notes, follow-up/handoff tasks, and the opt-in reply-trigger rule.

## Routes
- `/` redirects to `/crm/inbox`.
- `/crm/inbox`: internal team inbox, conversations, notes, handoffs and reply-trigger settings.
- `/crm`: customer records, lifecycle and follow-up tasks.
- `/api/assistant/reply-rule`: authenticated rule settings, **not** an external messaging integration.
- `/api/assistant/workspace`: authenticated customer-service data endpoints with role checks.

## Removed
General-purpose AI chat, software/code execution, GitHub Actions experiments, repository browsing, marketing studio, image generation, creative campaigns, integrations hub, agent workspaces and unrelated API routes.

No real WhatsApp/Messenger sending is added by this cleanup; internal notes stay internal.

## Local development
```sh
npm install
npm test
npm run build
npm run typecheck
npm run dev
```
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in your environment, using an authorized Supabase project.

## Database safety
Historical migrations are deliberately retained for reproducibility. Some historical migrations create legacy marketing/assistant tables: their presence is **not** an active app feature. This change does not drop tables, delete records, or alter a production Supabase project. Review a separate data-retention/migration plan before removing legacy tables or stored assets.

## Access & limitations
Customer data is scoped by organization and protected using existing Supabase policies and authenticated endpoints. Confirm role and RLS behavior in staging before production deployment; test any multi-organization membership scenarios.
