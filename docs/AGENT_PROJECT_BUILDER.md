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
canonically equivalent task** (small Arabic spelling/whitespace variation only).
When found, it reuses the full validated source manifest without
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
- Approved public-safe projects are dispatched from the server in the
  plan/approval request, not delayed until the browser performs another step.
- Poll updates use a workflow request-ID compare-and-set; stale runs cannot
  overwrite the next attempt or record duplicate completion experience.
- Existing test files cannot be altered by a model-generated repair to mask
  failures. The repaired implementation must pass the original tests.
- New model planning/repair uses **at most one strict :free candidate** per
  step and a 38-second request timeout to protect the Vercel 60s budget.
- Authenticated GET polls GitHub, recovers completed result using the
  reported workflow timestamp, verifies exit logs, records progress
  and decides whether a single repair is allowed.

No user or application secrets may be sent in the workflow, and obvious
private-key and token patterns are rejected. Pattern detection is not a
guarantee against disclosure: generated source may still contain personal
information. Only public-safe predefined recipes may auto-dispatch.

## Learning without AI requests

1. Verified successful projects are saved as evidence scoped to the owner.
2. A future **canonical equivalent request** can reuse those files without model API
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


## Improvements staged for review (2026-10-21)

**Independent acceptance:** The trusted AGENT workflow can now run a separate,
read-only HTTP acceptance suite mounted outside generated project files for
audited inventory or task-board recipes. The test result is not accepted
without the independent acceptance marker. Arbitrary newly generated apps
still require dedicated independent acceptance specifications: their own
Node tests are not sufficient evidence of full requirement coverage.

**Owner project history:** Authenticated assistant conversations can select
among the ten most recent projects, see the current status and retrieve
owner-only ZIPs. The GitHub run reconciliation scans up to 200 workflow
dispatches, capped at two pages; IDs are still matched before trusting logs.

**Durable planning quota:** New AGENT-only migration
`agent_project_plan_quota_20261021` was applied to AGENT's Supabase database.
An atomic, owner-authorized RPC reserves one of two planning attempts in
ten minutes **before** the model call, so unsuccessful and timed-out planning
requests cannot bypass quotas. The new table has RLS and does not expose
another tenant's data.

**Background executor (not enabled yet):** New `internal-tick` POST route
is **fail-closed** unless ALL AGENT-only worker settings are provisioned:
`AGENT_PROJECT_WORKER_SECRET` (random >=32-character secret),
`AGENT_PROJECT_WORKER_DB_KEY` (AGENT project service-role credential),
`AGENT_PROJECT_WORKER_PROJECT_ID=gldlgdycgneadbqftcrj`, plus the existing
AGENT GitHub App connection and Supabase URL. The worker validates the
AGENT database hostname and uses the original owner/organization scope
for every row. A tick processes only one previously approved project:
dispatch, poll, one bounded model repair, or expiration. A signed scheduler
must be configured separately. **No worker secrets, service-role access,
scheduler or preview GitHub credentials were provisioned during this work.**
Without those settings, there is no unattended progression while tabs are
closed. Do not configure these credentials without scoped approval and a
review of production access.

The workflow on `main` still accepts only the old one-file
`code_b64` experiment input. Branch CI passing does not prove the full
multi-file `workflow_dispatch` contract until a reviewed default-branch
rollout, or a separately verified equivalent deployment.

## Limits

- Offline recipes build a **Node.js task manager** and **Arabic inventory site**.
  Other projects may reuse an exact previously tested version.
- New app creation is still restricted to Node.js built-ins, static UI,
  and bounded JSON files; no arbitrary dependencies or install commands.
- The **first approved dispatch starts server-side**, and its GitHub job runs
  after the user closes the tab. Poll/reconciliation and model-generated
  repair still need an authenticated call (currently from the browser),
  so the complete repair cycle is **not unattended** after a tab closes.
  A secure owner-scoped background worker remains necessary for that claim.
- GitHub APIs, Supabase APIs and web infrastructure are still required
  to coordinate hosted execution; **zero model API calls** does not mean
  zero infrastructure API requests or universal understanding without AI.
