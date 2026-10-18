# AGENT connectors and browser: controlled extension roadmap

## Current release (v1)

The new `/assistant/integrations` hub is a **registry and setup interface**, not an OAuth marketplace yet. It also supports persistent per-user enable/disable switches for the implemented public GitHub code reader and the bounded public browser reader, backed by `assistant_connector_settings` with organization/user RLS. Every chat tool invocation checks this setting on the server (UI-only disabling is not trusted). The backend `GET /api/assistant/integrations` requires a valid organization member session and provides only environment-variable NAMES, metadata and bounded capability flags. No secret values are transmitted. AI provider secrets remain on Vercel Production environment variables; changing them requires a redeploy.

| Capability | Implemented | Missing |
| --- | --- | --- |
| Gemini/Groq and supported text APIs | server keys, discovery, bounded automatic fallback | guaranteed free billing / account-level quotas |
| GitHub | public allowlisted `Premieros/.com` source snippets and documentation, read-only | private-repo OAuth, GitHub Apps scopes, code writing, PR generation |
| AGENT Supabase | existing authenticated RLS-backed AGENT chats / marketing records | arbitrary DB tool execution (intentionally denied) |
| Premier.OS Supabase | none, project is a public-code test case only | isolated tenant-scoped read-only connector and explicit authorization |
| Browser | controlled public HTML text fetch on exact allowlisted domains with no redirects | full JavaScript browser, login, click, form submission, screenshots |
| Facebook / Instagram | catalog and setup instructions | Meta OAuth, scope/page selection, callback token vault, webhooks, human-reviewed publishing |
| WhatsApp Cloud API | catalog and setup instructions | WABA onboarding, webhooks, approved templates, human-reviewed outbound messaging |

### Browser security boundary

`lib/public-browser-tool.ts` enforces HTTPS, no credentials, a literal hostname+path allowlist, no HTTP redirects, response-content type and size constraints, and a timeout. Remote HTML is converted into plain text and wrapped as untrusted context for the assistant. It cannot execute scripts, authenticate or interact with the page. This is **not** a generic web search or headless browser.

### Connector contract planned for v2

Each connector should declare:
- manifest: stable `id`, owner, version, display name, minimum scopes and capabilities
- auth: per-organization delegated OAuth or server-side encrypted secrets, never client-local permanent storage
- tools: read and write actions separately, with JSON Schema input/output validation and strict resource scoping
- approvals: effects classified as `read`, `draft`, `write`, `send`, `publish`, `financial`; the last four require explicit human approval and audit records
- runtime safeguards: network/host allowlists, rate-limit and quota budgets, idempotency keys, timeout/cancellation, retries only when safe, audit log and credential revocation
- tests: authorization/tenant isolation, prompt-injection resilience, webhook signature verification, failure states and duplicate delivery guards

### Delivery phases

1. **V1 foundations**: sidebar/full-height UI, skill catalog, connector status, AI key setup, limited browser page reader, GitHub public reader.
2. **V2 repository worker**: real GitHub App OAuth with repository allowlist; read complete scoped files; generate diff proposals; run tests in isolated ephemeral environments; create PR only after approval. No direct pushes to `main`.
3. **V3 connection manager**: secure per-tenant encrypted secret vault, OAuth callback, consent screen, connections health check and revocation. Read-only Supabase integration, never POS production as a disposable environment.
4. **V4 Meta integration**: Meta app permissions, pages/IG/WABA selection, verified webhooks, approval queues for posts/customer replies. Binding prices and external ad budgets stay human-controlled.
5. **V5 interactive browser**: isolated browser sessions with per-site allowlists, user confirmation on navigation / submitting forms, credential isolation and visual review prior to actions.

Do not claim any phase is operational until an end-to-end tool call under a real authorized account has succeeded. Future database-schema changes and production external actions need explicit user approval.
