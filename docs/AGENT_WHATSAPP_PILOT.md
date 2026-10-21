# AGENT — WhatsApp Cloud API pilot (`#مساعد`)

**Scope:** AGENT repository `Premieros/agent`, AGENT Vercel project, and **only**
Supabase project `gldlgdycgneadbqftcrj`. No other app, database or WhatsApp
number is contacted. Experimental; **outbound sending is disabled by default**.

## What exists

- `GET /api/whatsapp/webhook`: official Meta webhook verification challenge.
- `POST /api/whatsapp/webhook`: validates `X-Hub-Signature-256` using the
  Meta App Secret against the raw POST body. Messages are checked against the
  configured Phone Number ID. Delivery-status webhooks do not create contacts.
- Stores customer text and phone in **AGENT-only CRM** `leads`, `conversations`,
  `messages`. Adds a uniquely claimed inbound receipt in
  `agent_whatsapp_pilot_events`; duplicate webhook delivery does not cause a
  duplicate customer message or second reply.
- If AI conversation mode is active, **the owner has enabled the assistant
  reply rule in `/crm/inbox`**, message begins exactly with the selected
  trigger (default `#مساعد`), the message is within Meta's customer-service
  window, and `AGENT_WHATSAPP_PILOT_SEND_ENABLED=true`, the handler attempts
  **one fixed test acknowledgement**. No AI generation or unrestricted chat.
- Unknown messages: save to AGENT Inbox **only**. Humans can take over an
  existing WhatsApp conversation via `/crm/inbox`. The bot never overrides
  `mode='human'`. External messages are not sent for human handoff automatically.

## Owner setup (never paste secrets into chat, issues, code or workflow runs)

Use **Meta for Developers → WhatsApp → API Setup** with a dedicated test
number and permitted test recipient(s). Confirm the WhatsApp Business Platform
permissions and any messaging limits or charges from Meta before continuing.
A personal WhatsApp Web login or WhatsApp Business mobile app alone is not
a Cloud API connection.

In **AGENT Vercel Preview** only (git branch:
`dev/multifile-work-engine-20261020`) configure encrypted variables:

| Variable | Value |
| --- | --- |
| `AGENT_WHATSAPP_VERIFY_TOKEN` | A new random secret, at least 16 characters; enter the same string in Meta webhook verification |
| `AGENT_WHATSAPP_META_APP_SECRET` | Meta Developer App Secret, not a GitHub App key |
| `AGENT_WHATSAPP_PHONE_NUMBER_ID` | Numeric WhatsApp Cloud API Phone Number ID of the test line (not the telephone number itself) |
| `AGENT_WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API token scoped to the test business number; preferably a durable, limited credential |
| `AGENT_WHATSAPP_ORGANIZATION_ID` | UUID of the *correct AGENT CRM organization*, never another organization |
| `AGENT_WHATSAPP_DB_KEY` | **AGENT project only** server-side privileged key. Elevated access; review and authorize separately; never expose to browser |
| `AGENT_WHATSAPP_PILOT_SEND_ENABLED` | `false` until webhook storage and signature tests pass; then `true` only for approved test recipients |
| `AGENT_WHATSAPP_GRAPH_VERSION` | Optional Meta-supported `vNN.0` API version (code defaults to `v23.0`); verify compatibility with your Meta app |

**Important:** A project-wide Supabase service-role key is privileged, even
though the endpoint pins the AGENT project hostname and organization UUID.
Do not upload such a key or widen access without explicit review. Consider
dedicated least-privilege credentials for future production operation.

Deploy the development branch again to load the new environment variables.
For Meta webhook setup use:
- Callback URL: `https://<publicly-accessible-AGENT-host>/api/whatsapp/webhook`
- Verify token: the exact `AGENT_WHATSAPP_VERIFY_TOKEN` you created.
- Subscribe to the WhatsApp Business Account's **messages** webhook field.

**Deployment protection:** Preview deployments may have Vercel SSO protection.
Meta must be able to reach the callback unauthenticated. Do **not** disable
protection for the entire AGENT app to accommodate this test. Review a secure
public callback solution or narrowly scoped deployment separately.

## Pilot

1. In AGENT's Inbox, enable the owner's `#مساعد` reply rule.
2. Confirm the Meta test phone ID, signed webhook and single designated AGENT
   organization. Test `GET` verification first.
3. From a Meta-authorized test recipient, send `#مساعد` to the Cloud API
   business test number. This should add a customer chat and, when **outbound
   pilot enabled**, return the exact test acknowledgement:
   `أهلًا بك 👋 أنا مساعد AGENT التجريبي. تم استلام رسالتك بنجاح. لو حابب تتحدث مع موظف، اكتب: موظف.`
4. Send `أهلا` without the trigger: AGENT saves it but does not reply.
5. Re-send an identical signed webhook event (same `wamid`) in a secure
   local test: it must not create or send a second message.
6. Take over the conversation in Inbox as a human and try the trigger again:
   no bot response must be sent.
7. Disable `AGENT_WHATSAPP_PILOT_SEND_ENABLED` after the trial.

If Meta accepts a reply but AGENT cannot confirm the database update, that
reply is **not automatically retried**; this deliberately favors no duplicate
customer messages during the pilot. Check logs and the private pilot-events
table inside AGENT if an acknowledgement is missing.

## Limitations

- No actual Meta credentials have been installed by this change.
- No real WhatsApp messages have been sent or received in this build.
- This pilot uses a **fixed test response**, not generative AI.
- Cloud API business-initiated template rules and Meta's pricing/limits still
  apply. This pilot replies only to recent customer messages.
- Messages and phone numbers are personal data. Configure a lawful privacy
  notice, retention policy, and appropriate customer consent before broad use.
