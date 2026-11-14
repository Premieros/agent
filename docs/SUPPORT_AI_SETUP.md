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


## Public website chat (feature-gated; never enable before review)

Additional files: `app/api/support/public/sessions/route.ts`, `app/api/support/public/messages/route.ts`, `app/support/widget.js/route.ts`, and `supabase/migrations/20261103_support_public_limits.sql`.

1. Apply **both** additive migrations on a staging database first, then test organization and cross-project isolation.
2. Set `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** Vercel secret (never `NEXT_PUBLIC_`). This secret can bypass RLS; do not expose it or put it in the widget.
3. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` target the same AGENT database.
4. Configure an AI provider server-side (OpenAI or Gemini) for generated answers. Without an AI provider, visitor replies use a safe no-answer fallback. The admin test supports clearly labeled extractive previews without a provider.
5. Review traffic abuse protections, error behavior, and cost budgets. Only then set `SUPPORT_PUBLIC_CHAT_ENABLED=true` on a controlled deployment.
6. In `/support`, create a project, add text knowledge, and add an allowed HTTPS origin. Then place this in that website's HTML (replace placeholders):

```html
<script src="https://YOUR-AGENT-HOST/support/widget.js" data-widget-key="YOUR_PUBLIC_WIDGET_KEY" defer></script>
```

The `data-widget-key` identifies a configured website; it is not a secret. The server verifies the HTTPS Origin and project-bound session token for every message. Browsers store the visitor token in per-tab `sessionStorage`. There is no cross-site session cookie requirement.

### Important restrictions
- Do not rely solely on the Origin header as strong caller authentication. Enforce Vercel WAF / upstream rate limits in addition to database limits, and test anonymous abuse with a real edge deployment.
- Keep the public feature gate disabled until the migration, configuration, tests, security review, and audit are complete.
- The current lookup is conservative keyword matching over plain-text documents, not vector RAG. PDF/DOCX/XLSX extraction and embeddings need a later ingestion pipeline.
- The widget is a minimal web implementation; mobile apps need their own authenticated adapter.
- Vercel Preview environment AI secrets are not automatically inherited from Production. Configure scoped preview secrets only when appropriate.
- AGENT CRM and marketing data are separate from `support_*` tables.
