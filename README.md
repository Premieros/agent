# Agent — AI Sales & Marketing Workspace

Independent web application for selling POS and retail/factory software. Arabic-first, responsive, and designed for **AI-to-human handoff**.

## MVP scope

- Unified customer workspace and inbox (WhatsApp, Messenger, Facebook comments — **demo data only** until Meta credentials and approvals are configured).
- Qualification for restaurants, cafes, clothing retail, and clothing factories.
- Choose human handoff as **continue chat** or **schedule a phone call**.
- Lead pipeline and dashboard.
- Initial PostgreSQL schema with organization isolation and RLS, saved under `supabase/migrations/`.

> **Important:** The current interface is an interactive prototype. It does not send or receive real messages, spend ad budget, or persist demo changes. No Meta, OpenAI, or Supabase integrations are enabled yet. Supabase access to the target project must be granted before applying the migration.

## Local development

Requirements: Node.js 20.9+ (Node.js 22 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For type-checking:

```bash
npm run typecheck
```

## Environment

Copy `.env.example` to `.env.local`, and fill in values **only when integrations are built**. Never commit `.env.local`, service-role keys, Meta access tokens, or OpenAI API keys.

## Architecture (planned)

- **Next.js + TypeScript:** Arabic right-to-left web app; server-side API endpoints in future phases.
- **Supabase PostgreSQL:** users, organizations, leads, conversations, messages, handoffs.
- **Meta official APIs:** Webhooks + WhatsApp Business Platform + Messenger/Page APIs.
- **OpenAI API:** AI qualification, sales conversation, summary and route recommendation, subject to business safeguards.
- **Human takeover:** message routing prevents the AI from replying to threads while assigned to a human.

## Delivery phases

1. Working UI and data-model foundation (**this commit**).
2. Supabase project authorization, authentication, persisted leads, conversations, and assignments.
3. Meta developer application, permissions and live messaging/webhooks.
4. Agent orchestration and approved knowledge base for products/prices/hardware.
5. Campaign reporting and safe ad recommendations (human-approved budget changes).

## Security

The migration enables RLS on every public table, does not grant anonymous customer-data access, and requires organization membership for authenticated reads. Provision organizations and memberships through trusted server/admin workflows; secrets must be server-side. Review and test policies before production use.

## Database setup

Target Supabase project reference: `gldlgdycgneadbqftcrj`. Schema is **not automatically applied**. Review the file in `supabase/migrations/` and apply it only to that project after account access is confirmed.
