# AGENT: maintained structure and consolidation policy

_Last verified against `main`: 2026-11-08. This file describes repository code, not a claim that every feature is deployed or activated._

## One application, distinct modules

| Entry / folder | Purpose | Status in main |
| --- | --- | --- |
| `/` → `/assistant` | One primary authenticated multi-skill assistant UI | Active route |
| `/assistant/library` | Private library UI and approved document flows | Active route |
| `/assistant/integrations` | Connector settings and capability status | Active route |
| `/studio` | Marketing planning, multi-page profiles, reviewed AI missions | Active route |
| `/crm`, `/crm/inbox` | CRM and internal team messaging | Active routes |
| `app/api/assistant/` | Authenticated assistant and bounded tools | Maintained |
| `app/api/agents/` | Studio AI runs and provider access | Maintained |
| `lib/` | Shared security-aware services and AI orchestration | Maintained |
| `supabase/migrations/` | Versioned schema changes; never apply automatically during UI cleanup | Preserve |
| `tests/` | CI safety and regression checks | Preserve and expand |

`components/general-assistant.tsx` is the real homepage UI. Older
`agent-home.tsx` and `sales-workspace.tsx` demo views, plus their demo data module,
are not routed in main; the site editor should not propose changes to the obsolete homepage.
Do not merge a second application root or copy-paste another complete version of the UI.

## Open work not yet on main (as reviewed on 2026-11-08)

- [PR #19](https://github.com/Premieros/agent/pull/19) proposes multi-project Support AI,
  but its current diff ALSO includes Windows desktop companion files.
- [PR #20](https://github.com/Premieros/agent/pull/20) separately proposes the Windows
  desktop companion. The branches diverge, and the file sets overlap.
- **Do not merge both as-is.** Separate the Support AI-only commits/files into a
  focused branch based on latest `main`; keep the desktop companion in its own PR.
  Review tenant isolation, authentication, schema changes, migration order, and test
  evidence before enabling either in production.
- Support AI and desktop features must not be described as live solely because an open
  PR contains their source. Applying Supabase migrations and changing production
  connections require separate staged validation and approval.

## Safe cleanup rules

1. `main` stays deployable. Use review branches and CI; never force-push `main`.
2. Remove a component only after checking the active routes, import references,
   server-side file allowlists, tests, and any deployed consumer.
3. Keep the assistant, Studio, CRM and internal inbox as distinct modules behind a
   single shell, not independent competing app versions.
4. Before refactoring `app/globals.css` and `app/workspace-dark.css`, collect
   screenshot comparisons for assistant, CRM, Studio, mobile and desktop. Both are
   large and layered; deleting rules by name alone is unsafe.
5. Preserve existing Supabase projects, migration history, user records, secrets,
   and production deployments. This cleanup does not change any of those.
6. Add a regression check when deleting a legacy view or changing a route contract.

## Recommended next passes

- After this safe dead-code cleanup passes CI, inspect CSS duplication with visual
  regression coverage and split reusable design tokens from page-specific styling.
- Separate PR #19 from PR #20 before review/merge and validate migrations in an
  isolated staging environment.
- Reduce large components into feature-scoped modules incrementally, preserving
  current data permissions and user workflows.
