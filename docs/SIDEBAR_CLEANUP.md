# AGENT — streamlined sidebar (review preview)

Purpose: remove obsolete, duplicate, and excessive navigation from the
authenticated AGENT workspace. No database schema or project data changes.

## Visible navigation — six daily-use links

| Section | Link | Destination |
| --- | --- | --- |
| Assistant | المحادثات الذكية | `/assistant` |
| Customer support | محادثات العملاء | `/support/conversations` |
| Customer support | المشاريع والمعرفة | `/support` |
| Customer support | قنوات التواصل | `/support/channels` |
| Business | إدارة العملاء | `/crm?view=leads` |
| Business | الوكلاء والتسويق | `/studio?section=agents` |

The small **المزيد** disclosure still contains the private file library,
the internal CRM/team inbox, and integration settings. CRM subviews such as
tasks and account permissions remain accessible from CRM itself; Studio's
models, pages, campaigns, outputs, and creatives remain accessible from
Studio. They no longer inflate the global sidebar.

The obsolete **واجهة العملاء** demo link is removed from the global sidebar;
the preview still exists under `/support/customer` and through the support
administration page's explicit preview link. This is intentional to avoid
mistaking a demo for an active customer messaging channel.

The single global **محادثة جديدة** entry stays visible. Assistant chat history
is collapsed under **المحادثات السابقة** and no longer renders another
new-chat button, duplicate title, or footer. The thread list and deletion
controls remain intact, and the chat toolbar opens the saved history.

## Invariants

- No customer conversation, knowledge, agent, CRM, migration, or widget data
  is deleted. Routes remain unchanged and remain fully functional in their
  feature pages.
- No production changes or Meta activation. Existing two website integrations
  and the PIN quick-unlock header remain untouched.
- All new disclosure controls are keyboard-focusable, report `aria-expanded`,
  and provide a stable `aria-controls` target.
- CI checks the six primary entries, preserved legacy routes, chat actions,
  and PIN presence. A visual/mobile smoke test is still required before
  merging into production.
