# AGENT independent multi-file application builder (development branch)

Status: **development implementation only**. No main merge, database migration execution,
Vercel deployment, additional GitHub permissions, or paid service activation took place.

## Scope and actual gaps addressed

The original `/api/assistant/work` route builds one `work.js`, runs one bounded
Node command, and delivers `program.js`. A failure needs a new manual repair
proposal. The new `/api/assistant/projects` workflow adds a separate full-project
path rather than changing the legacy experiment.

A user request to create a complete application opens a review-first flow:

1. Generate a small multi-file application with an explicitly identified
   OpenRouter `:free` model (not conditional free-tier providers).
2. Validate relative paths, byte sizes, safe extensions, presence of real
   source and `*.test.mjs`/`*.test.js` files; refuse `package.json`
   supplied by the model.
3. Display every file, a concise plan, and the resource limits to the owner.
   **No execution yet.**
4. On the owner's separate approval, persist an immutable deadline and
   attempt cap, then allow the chat client to invoke one step at a time.
5. Execute syntax checks and `node --test` inside Vercel Sandbox, with
   `networkPolicy:"deny-all"`, one vCPU, 18 seconds/session and `stop()`
   in `finally`; never check out or mount AGENT's own source.
6. If real tests fail and budget remains, request a complete revised file
   manifest from a `:free` model and rerun the tests automatically.
   At most **two test attempts**, **one repair call**, **two total model
   calls** (initial generation + optional repair), **three minutes total
   after approval**. The model's success claim is not test evidence.
7. Present bounded observed stdout/stderr and commands, record a success/failure
   signal where actual execution evidence exists, and offer an owner-scoped
   ZIP download. Save the same ZIP to the private `agent-library` bucket
   on explicit user action. Positive repeated executions can only **suggest**
   a coding skill and never activate it.

## Non-spending gate (important)

A Vercel Sandbox can incur usage charges depending on plan and quota.
Because this project must **not spend money**, the multi-file workflow
refuses to approve or execute a Sandbox run unless the system operator has
independently verified an available free allocation and explicitly configured
`AGENT_FREE_SANDBOX_VERIFIED=1` in the AGENT environment.

This branch **does not** configure that variable. It cannot prove what
the account's actual remaining free allowance is, and the 18-second cap
is a duration cap, **not a dollar-denominated billing cap**. If no free
allocation can be verified, leave execution disabled; users may review and
download only completed experiments from prior runs.

The legacy single-file Work flow retains its existing runner behavior.
No new external service is provisioned and no credential is copied into
generated projects. Only an explicit, separately scoped operation should
ever enable a runner.

## Database and deployment separation

The migration `supabase/migrations/20261020_agent_project_builds.sql` is
staged in GitHub **only**, not applied. It adds an owner-scoped table with
RLS and a ZIP MIME allowance to the already-private AGENT library bucket.
Do not apply it to Premier.OS or another Supabase project.

Until that migration has been separately reviewed and applied to AGENT's own
database, API calls involving projects will fail with a missing-table error.
The implementation branch is not merged to main and is not promoted to
production. Existing work modes and migrations remain unchanged.

## Important current limitations

- Applications currently target Node.js built-ins with HTML/CSS/JS; no npm
  installation, framework dependency, Docker image, external credentials,
  internet, managed database or third-party service.
- Projects are intentionally capped at 22 source files, 24 KB each and
  115 KB of total source to bound ZIP, model output and review costs.
  The model is asked for fewer files to fit free-model output limits.
- The end-to-end step chain is advanced by an authenticated **open chat**.
  On a browser close or network outage it pauses; reopening the conversation
  resumes a ready/repairing state. A timed-out in-flight test is marked
  failed and is **never silently rerun**. This is not yet an always-on
  durable background worker.
- Existing build checks verify TypeScript, Next.js build, path safety,
  ZIP structures and a trusted end-to-end Node fixture. They do **not**
  establish live Vercel Sandbox availability, remaining free quota or
  successful generation from every connected model.
- No GitHub Actions public dispatch is used for multi-file projects because
  it would expose user-generated files or results on a public repository.
- No auto merge, PR, GitHub push, Vercel deployment, or auto-save occurs.

## Verification

`npm run test:research`, `npm run build`, and `npm run typecheck`
are run by `.github/workflows/check.yml` on the dedicated development
branch. Check the actual GitHub Actions run before promoting any change.

## Suggested next gate

Review the migration and production-free-tier evidence, then test one harmless
standalone task end-to-end in an isolated preview with explicit consent.
Only after this passes should a reviewer consider a PR against main.
