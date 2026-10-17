# AGENT — Multi-page AI Sales & Marketing

Arabic-first web workspace for running multiple Facebook and Instagram brand workspaces, producing AI-assisted marketing drafts, managing customer leads and internal team handoff.

**Production site:** https://premieros-ai-sales-agent.vercel.app  
**Multi-page AI Studio:** https://premieros-ai-sales-agent.vercel.app/studio  
**Authenticated CRM:** https://premieros-ai-sales-agent.vercel.app/crm  
**Team Inbox:** https://premieros-ai-sales-agent.vercel.app/crm/inbox

## Current capabilities (October 2026)

- **Supabase persistent data:** organization membership, leads, handoff tasks, conversations, messages, marketing pages, agent missions, agent outputs, private creative assets.
- **Real multi-page workspace:** add internal Facebook/Instagram page profiles; configure offering, audience, brand voice per page. A profile is *not* a Meta-connected page until official OAuth succeeds (not implemented yet).
- **AI manager/orchestration backend:** when a supported provider API key is configured or entered for the current session, a human can trigger a run that calls a director, strategist, copywriter, visual designer, media buyer, customer support, and reviewer. Responses are saved to Supabase and marked for human review.
- **Visual designer:** a separate explicitly confirmed action generates a real image with a supported OpenAI or Gemini image API and stores it in a **private** Supabase Storage bucket, limited to 3 images per mission. API usage may incur cost.
- **Editorial approval:** humans review and approve drafts **internally only**. No publishing, automatic replies, Meta spending, or automated messaging actions are wired yet.
- **CRM and internal inbox:** actual authenticated customer storage, notes, follow-up task creation, human-takeover mode. Internal notes are never sent to external channels.
- **Original UI prototype:** `/` still contains demo conversations and does not represent real customer activity.

## Economical agent execution (default)

The Studio defaults to **Economy — 1 AI request**. It creates director, strategist, copywriter, designer, media-buyer, support, and initial-reviewer sections from a **single model call** and saves all seven sections separately for the UI. The reviewer section is an initial self-review within the same model response, **not an independent agent audit**. Keep human sign-off. For an independent model-based review, switch to **Full — 7 AI requests**; this uses more API calls and can consume more quota. Provider pricing is not guaranteed and depends on response size, actual model rates, and billing tier.

Production `GEMINI_API_KEY` is read only on the server from a Vercel Sensitive environment variable. The Studio can therefore run Gemini without retyping the key after a successful production redeploy. The default model is based on the model successfully tested in the Studio, but availability can change; use model discovery when necessary. The environment variable key should never be a `NEXT_PUBLIC_` value.

## Bring your own API key — 8 AI providers

In `/studio`, choose **Gemini, OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together AI, or Anthropic**; enter the matching API key and model ID, then click **Test key** (makes a small real provider request). After a successful test, create a mission and launch the agents. The API key stays in the current page's React memory: it is submitted to the authenticated server API for the action, never saved to Supabase, localStorage, GitHub, or visible server logs. **Refreshing the page clears it.** Always use HTTPS and trust the site before entering a credential.

Supported vendor endpoints are hard-coded and validated server-side; arbitrary provider URLs are deliberately not accepted to prevent SSRF and credential exfiltration. A random key or a key from a provider not in this list will not work. Models and free quotas depend on the provider and may change. Agent runs involve multiple API calls; even a free-tier key can be subject to limits or paid usage. Test with the shortest task first.

For image generation, currently only **OpenAI** and **Gemini** image generation are implemented. Your selected account must support its image model. Other providers support text outputs / design briefs only; they do not produce images on this implementation. No external posting/ad spend is connected.

For persistent server-side operation, optionally configure these secrets on Vercel: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, `TOGETHER_API_KEY`, `ANTHROPIC_API_KEY`. This is optional; in-memory BYOK does not require Vercel credentials. Never store provider secrets in `NEXT_PUBLIC_` variables.

## Production environment on Vercel

Set environment variables in Vercel Project → Settings → Environment Variables. **Never post keys in a chat or commit them to GitHub.**

| Name | Exposed? | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public URL | yes (already configured) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public client key | yes (already configured) |
| `OPENAI_API_KEY` | **server-only secret** | optional alternative to entering a key in Studio |
| `OPENAI_AGENT_MODEL` | server-only optional | defaults to `gpt-4.1-mini` |
| `OPENAI_IMAGE_MODEL` | server-only optional | defaults to `gpt-image-1` |

After setting `OPENAI_API_KEY`, redeploy on Vercel for the runtime to see it. The agent status endpoint reports readiness without returning secrets. **Each agent run makes several paid OpenAI API requests.** Every run requires a user click and confirmation. This is not the same as a ChatGPT account subscription.

## Work needed before live Meta automation

You must connect the right Meta Business Manager and grant official permissions for each Facebook Page/Instagram account, ad account and WhatsApp Business entity where relevant. Integrate OAuth, secure per-page token storage, webhook signature verification, approved messaging permissions, media publishing, delivery receipts, and ad account permission checks. Support human approvals and enforce spend ceilings **server-side** before a production launch. These integrations are NOT implemented or activated by the current page profile workflow.

## Run locally

Node.js 22 recommended:

```bash
npm install
npm run dev
npm run build
```

## Database & security

Target Supabase project: `gldlgdycgneadbqftcrj`. Applied migrations are stored in `supabase/migrations/`. Each application table uses organization-scoped RLS. Private image objects use membership-controlled Storage RLS. Agent actions use authenticated server routes and perform role checks.

Known Supabase Security Advisor notices: the three internal inbox RPCs use carefully scoped SECURITY DEFINER and are intentionally callable by team members; leaked-password protection requires enabling in Supabase Auth settings. Test all RLS policies with multiple real tenant accounts before broad public rollout.

No `service_role` secret is exposed in client code. Do not add secrets to `NEXT_PUBLIC_` variables.

## Release boundary

The studio is functional for managing **internal page profiles, projects, approval states and persisted records**. AI runs and image generation require a real server API key; live page posting, paid ads, and external customer replies require additional Meta authorization, official API integration and end-to-end testing. Do not market those pending integrations as currently operational.
