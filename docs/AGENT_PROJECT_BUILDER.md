# AGENT project runner — incremental autonomy, zero-model reuse, GitHub Actions

Status: **development branch and preview only**. Main is unchanged, no new
permissions or paid services were enabled. The additive project schema was
applied and verified in AGENT's existing Supabase project.

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
3. Both audited local task-board and inventory recipes need **zero model calls**.
4. Verified outcomes feed model preference signals when applicable, while
   repeated evidence can create **suggested** skills, not activate new
   privileges or arbitrary external tools.
5. These are deterministic skills and project templates, not new weights
   in an AI model. A novel requirement may still need an AI model or
   an explicit new implementation.

Storage is the existing private AGENT Library; owner can download a ZIP and
save it privately. No auto-upload to public repositories.

## Current rollout state and testing gate

AGENT main remains unchanged. The Supabase migration
`agent_multifile_project_builds` was applied to AGENT on 2026-10-21. The
project table, owner-only RLS, three owner policies and private ZIP support
were verified after the change. No other project's resources were accessed.

The branch CI checks Next.js, TypeScript, agent regressions and both audited
multi-file applications in the readonly, network-denied GitHub Docker runner.
Successful CI is evidence for the fixed recipes, **not proof of live
plan-to-dispatch-to-repair execution from the site**.

**Preview limitation:** The existing AGENT GitHub App credentials are scoped
to Vercel production only. They were **not copied to preview**, because doing
so would expand credential exposure. Preview can create a deterministic app
with zero model calls and offer its owner a ZIP stamped **NOT TESTED - DRAFT**.
The UI disables the unavailable runner approval. A reviewer must explicitly
authorize a safely scoped preview connection before live dispatch testing,
or approve a reviewed rollout after source verification.

**Model limitation:** Arbitrary new applications need a configured strict
OpenRouter `:free` model. Existing conditional-free Gemini and Groq tier
keys do not establish guaranteed zero cost and are not used by this engine.
Offline recipes cover a generic task board and a generic Arabic inventory app.
Identical owner-verified requests can reuse their previous files without AI.

### Acceptance test after preview runner authorization

1. Request a generic Arabic inventory app. Check six complete files and
   `model_calls=0`.
2. Verify an authenticated, owner-scoped ZIP marked unverified is available
   without remote execution.
3. Dispatch GitHub Actions and check that the returned workflow contains
   named Node TAP test totals, zero failures and an actual zero exit code.
4. Verify the final ZIP records the actual result. A standalone "PASS"
   string is never sufficient evidence.
5. Repeat the exact task and check no unnecessary model use or approval.
6. Keep the existing production branch and other resources unchanged.


## Limits

- Offline recipes build a **Node.js task manager** and **Arabic inventory site**.
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
