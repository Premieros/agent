# AGENT project runner — incremental autonomy, zero-model reuse, GitHub Actions

Status: **development branch only**. No merge, deployment, permission escalation,
Supabase migration application or external billing configuration has occurred.

## Autonomy and permissions

The agent should **not** ask for approval on every planning, test, repair or
artifact step. A familiar, public-safe, audited recipe (`build a todo app` /
`ابن تطبيق إدارة مهام`) is prepared **without any model or AI API call** and,
if the existing GitHub Actions App is configured, automatically enters the
bounded test loop.

For other tasks, AGENT first checks for a **previously successful, owner-scoped,
exact task**. When found, it reuses the full validated source manifest without
calling a model. A new task uses an explicitly identified OpenRouter `:free`
model; failures may use one further free-model repair attempt.

Approval is required **once per new project** only when its generated source
must be sent to a **public GitHub Actions workflow**, because its inputs/logs
may be visible. The source is displayed before that approval. Once approved,
no repeated consent is requested for test/repair/retest. No consent is
needed for read-only evaluation or trusted built-in generic code.

GitHub Actions usage eligibility and free allocation are account-specific.
The standard public-repository runner is intended for no-cost usage, but this
implementation cannot independently guarantee that GitHub will never apply
billing, usage limits or policy changes. It never purchases capacity.

## GitHub job boundary

Uses the *existing* GitHub App installation scoped to
`Premieros/agent`, with **actions:write only**. No repo contents write,
no push, no PR, no deploy, no new credential or integration.

The `.github/workflows/agent-experiment.yml` workflow was extended to accept
a bounded JSON project manifest (up to 40 KB decoded), retaining its old
single-file experiment mode. Runner:

- `permissions: {}` and **no actions/checkout**.
- Host only validates and writes files into `RUNNER_TEMP`; user/generated
  source executes inside `node:22-alpine` with
  `--network none --read-only --cap-drop ALL --user 65534:65534`,
  `--security-opt no-new-privileges`, CPU/memory/pid caps, and fixed
  `node --check` / `node --test` commands.
- Per job hard limit 4 minutes; code execution maximum 45 seconds.
- At most two test dispatches and one LLM repair per project; deadline after
  starting is 12 minutes, including GitHub queue time.
- GitHub dispatch request IDs are stored **before** the API call, avoiding a
  blind resend if the request times out or the browser disconnects.
- Authenticated GET polls GitHub, recovers completed result using the
  reported workflow timestamp, verifies exit logs, records progress
  and decides whether a single repair is allowed.

No user or application secrets may be sent in the workflow, and obvious
private-key and token patterns are rejected. Pattern detection is not a
guarantee against disclosure: generated source may still contain personal
information. Only public-safe predefined recipes may auto-dispatch.

## Learning without AI requests

1. Verified successful projects are saved as evidence scoped to the owner.
2. A future **identical request** can reuse those files without model API
   calls; the files are validated again before execution.
3. The audited built-in task-board recipe needs **zero model calls**.
4. Verified outcomes feed model preference signals when applicable, while
   repeated evidence can create **suggested** skills, not activate new
   privileges or arbitrary external tools.
5. These are deterministic skills and project templates, not new weights
   in an AI model. A novel requirement may still need an AI model or
   an explicit new implementation.

Storage is the existing private AGENT Library; owner can download a ZIP and
save it privately. No auto-upload to public repositories.

## Deployment gap (important)

This change is only in
`dev/multifile-work-engine-20261020`. GitHub only dispatches a revised
workflow once the revised workflow is on the **default branch**.
No change to `main` was authorized, so live multi-file workflow_dispatch
cannot yet be validated from the production AGENT code.

The staged Supabase migration adds the project table, owner RLS,
GitHub request/run identifiers, zero-model accounting and ZIP MIME support.
It has not been applied to AGENT's database, and must never be applied to
Premier.OS.

A GitHub Actions check on the dev branch tests Next.js build, TypeScript,
security boundaries and a trusted six-file local runtime fixture.
This does not prove production end-to-end dispatch/retest until a reviewed
rollout is explicitly authorized.

## Limits

- The first audited offline recipe builds a **Node.js task manager**.
  Other projects may reuse an exact previously tested version.
- New app creation is still restricted to Node.js built-ins, static UI,
  and bounded JSON files; no arbitrary dependencies or install commands.
- The chat UI advances repairs when it is open; an in-progress GitHub job
  continues even after a tab closes, and its result can be reconciled upon
  reconnect. Fully autonomous cloud scheduling for subsequent repair steps
  is a future improvement.
- GitHub APIs, Supabase APIs and web infrastructure are still required
  to coordinate hosted execution; **zero model API calls** does not mean
  zero infrastructure API requests or universal understanding without AI.
