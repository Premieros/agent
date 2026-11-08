# AGENT — unified, cleaned preview

This review branch combines the **new multi-section AGENT user interface**, the
existing Support AI website features, a review-only social channel connector
foundation, and the safe legacy cleanup.

- Main authenticated assistant: `/assistant`. `/` redirects here.
- Marketing agents: `/studio`.
- CRM and internal inbox: `/crm` and `/crm/inbox`.
- Existing customer support projects and knowledge: `/support`.
- Existing customer support conversations: `/support/conversations`.
- Social channel setup information: `/support/channels`.
- Integration settings: `/assistant/integrations`.
- Two existing website integration APIs: `/api/support/premier-inbox`,
  `/api/support/johna-inbox`, and public website widget routes.

The three retired demonstration sources (`components/agent-home.tsx`,
`components/sales-workspace.tsx`, `lib/demo.ts`) were not active routes.
The previously redundant sidebar entry for a root dashboard was removed,
while the new navigation and `app/agent-light-theme.css` remain.

## Safety / deployment

This is a Vercel **preview branch**, not the deployed `main` and not a
replacement of two live customer-service sites. No changes were applied to
Supabase, application secrets, external Meta accounts or production URLs.

Do not merge this branch to `main` without disentangling the overlapping
desktop and support pull requests, reviewing their schema/security impact,
testing the two live site integrations, and confirming production readiness.

The Meta webhook is **not** a working WhatsApp/Facebook/Instagram inbox:
it verifies signed incoming events but intentionally does not acknowledge
incoming customer texts until durable event ingestion and approved
outbound channel connections exist.

## Checks

Run `npm run test:research`, `npm run build`, and `npm run typecheck`.
Smoke-test the assistant, Studio, CRM, support admin, support conversations,
new support channels, two existing website widgets, and login in a preview.
