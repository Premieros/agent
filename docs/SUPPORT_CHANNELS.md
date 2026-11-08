# AGENT — Multi-channel customer service connections (review foundation)

**Scope:** This is an additive, non-production channel foundation on top of existing
`feature/support-ai-multproject`. The two currently connected website customers'
sessions, `support_widgets`, website message routes and knowledge documents are unchanged.

## Channel map

| Source | Route / adapter | Current status |
| --- | --- | --- |
| Existing websites | `/support/widget.js`, `/api/support/public/*` | Existing implementation; preserved |
| More HTTPS websites | Admin project + website-origin widget | Existing mechanism, add one origin/key per site |
| WhatsApp Business Cloud API | `/api/support/channels/meta/webhook` | **Secure handshake and signature parser only; not an active inbox** |
| Facebook Messenger Pages | Same signed Meta webhook | **Secure parser only; not receiving durable messages** |
| Instagram professional messaging | Same Meta adapter | **Parser only; outbound implementation pending** |
| Native mobile app | Signed user SDK / dedicated API | Planned; a web Origin is not mobile authentication |
| Other platforms | Provider-specific adapter → canonical support conversation | Planned |

## Status of this branch: no traffic activation

The server now has:
- Constant-time `hub.verify_token` subscription verification (server-only `SUPPORT_META_VERIFY_TOKEN`).
- Constant-time `X-Hub-Signature-256` HMAC SHA-256 validation using server-only
  `SUPPORT_META_APP_SECRET` and the exact incoming HTTP body.
- Strict, bounded parsing of text events, distinct source-account IDs and message IDs.
- No access tokens in source, browser, source control, responses or logs.

**Critical:** Never set `SUPPORT_META_WEBHOOK_ENABLED=true` on a live public endpoint yet.
POST deliberately returns HTTP 503 for valid incoming text events. This prevents a false
200 OK acknowledgment that would silently discard customer messages before the
durable channel inbox/outbox has been installed and tested. There is currently
**no** Meta message reception, AI response, external message send, Meta account
connection, database migration, or deployment included with this change.

## Safe steps for adding a third website right now

1. Use the existing AGENT support admin view to select/create the relevant project.
2. Add a separate `support_widgets` entry for the new trusted HTTPS origin.
3. Embed `/support/widget.js` on the authorized site with that widget's public key.
4. Test a real user session and the handoff queue on that origin. The widget key is a
   public identifier, not a secret; origin validation must be enforced server-side.
5. Keep project knowledge, tenant permissions, and site traffic limits separate.

The user reports two production websites already working; **do not rotate their keys,
remove origins or alter their project mappings** during channel expansion.

## Steps to connect Meta after the durable inbox is implemented

1. In your own Meta Business settings, select the WhatsApp Business Account/phone
   number and/or Facebook Page and any Instagram professional account.
2. Set up the appropriate Meta developer app, supported permissions and app review
   for the exact business assets and use cases; check Meta's current official API
   requirements before production (platform policies and versions change).
3. Store app secret, verify token and each authorized Page/phone access token only
   as server-side deployment secrets. Never paste them into AGENT's website widget,
   GitHub, or a chat. Restrict who can configure them.
4. Provision an organization/project-scoped connection mapping for each **phone
   number ID** (WhatsApp) or **Page ID** (Messenger); never route using untrusted
   user-provided project IDs.
5. Implement tenant-scoped durable event IDs and deduplication, customer thread
   mapping, queue/outbox, retries, per-account rate limits, audit logs and token
   revocation before acknowledging signed customer messages.
6. Add explicit per-project auto-reply/human handoff modes. Outbound WhatsApp and
   Messenger sends must check recipient authorization, messaging windows, policy
   constraints and current Meta API version. Customer-facing AI must only cite
   the selected project's approved knowledge; never cross business boundaries.
7. Test verified inbound/outbound conversation flows, duplicate delivery, signature
   rejection, cross-tenant isolation, media attachments, token revocation and
   human takeover on staging. Enable production per channel only after review.

## Required storage model (design only; no migration applied)

- `support_channel_connections`: scoped organization, project, channel, external
  account ID, enabled flag, secret reference; unique channel/account ID.
- `support_channel_threads`: external user ID linked to existing
  `support_conversations` (and tenant/project); restricted and encrypted where needed.
- `support_channel_events`: unique provider message ID for idempotent ingestion,
  durable processing state and safe retries.
- `support_channel_outbox`: approved outgoing messages with delivery status,
  idempotency keys, budgets, and user-visible failure reasons.
- RLS, service-role separation and authorization tests for all new tables.
- Generate a reviewed migration with the Supabase CLI before deploying this schema.
  Do not change the current production database as part of this PR.

## Browser-side limits

Facebook and WhatsApp *share Meta's ecosystem but are not the same API*.
Website widgets are separate from server-to-server webhooks. The endpoint is not
a universal receiver for any arbitrary social network; each new provider needs
its own validated signature, payload adapter, and supported sending method.
