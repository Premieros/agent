# Support AI — integration inside AGENT

This feature lives in the existing `Premieros/agent` Next.js application. It is **not** a new Supabase project or a new deployment.

## Scope delivered in this pull request
- Additive `support_*` database tables, keyed by organization and project with tenant RLS.
- Admin-authenticated project, knowledge document, and website-origin/widget-key APIs.
- Arabic management screen: `/support`.
- No change to existing `organizations`, `leads`, `conversations`, `messages` or marketing modules.
- Existing AGENT production chat and marketing pages remain untouched.

## Setup
1. Review the migration `supabase/migrations/20261103_support_ai_multproject.sql`.
2. Apply it to AGENT's Supabase instance **only after** securing database management permissions and testing in staging.
3. Visit `/support` while signed in as an AGENT organization admin or manager.
4. Create one project per business (Premier, AMMCO, etc.). Each project has its own knowledge and system instructions.
5. Add a trusted HTTPS website origin; keys shown are **public identifiers, not secrets**.

## Current limits — intentionally not live
This is an admin/data foundation only. The public customer chat endpoint, RAG/embedding pipeline, file parsing for PDF/DOCX/XLSX, website widget, per-customer session authorization, production rate limiting and AI auto-answer remain to be implemented and security tested. Do **not** paste widget keys into external sites yet or advertise a working website chat. The admin API currently supports text/Markdown/CSV/JSON content (plain text).

## Required hardening before external enablement
- Server-only route with origin allowlist, CORS, per-customer signed sessions and per-project rate limits.
- Server-side scoped access to project documents and RAG search; never trust a user-provided project id.
- Explicit token-cost controls and fallback/human takeover.
- Verify RLS as members of two separate organizations and cross-project access attempts.
- Test migrations against a staging copy; preserve existing AGENT migrations and data.
- Validate usage and log retention, prevent prompt injection and redact sensitive content.

## Connecting sites (after widget API is complete)
The integration contract should be a public widget identifier plus server-validated HTTPS origin. Each website gets a different key. Mobile apps must use a separate authenticated SDK, because origin validation cannot authenticate a native application.

## Safety
No destructive migrations, no automatic sending of customer messages, and no modifications to existing AGENT business tables are part of this PR.
