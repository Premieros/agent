# AGENT preview-only GitHub App connection — operator checklist

Status: **requires GitHub/Vercel owner action.** Do not put secrets in a PR, chat, GitHub Actions input or a public repository.

## Preconditions
- AGENT repository only: `Premieros/agent`; database target only: AGENT Supabase project `gldlgdycgneadbqftcrj`.
- Draft review PR: https://github.com/Premieros/agent/pull/18
- **Review PR #18 before any merge to main**; it proposes one workflow file only, retains legacy `code_b64`, adds `project_b64` and `acceptance_kind`, and keeps `permissions: {}` with network-denied Docker.
- Main is deliberately unchanged until owner approval. A green PR CI does not prove live `workflow_dispatch`.

## Dedicated preview GitHub App
1. In GitHub, open **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Create an app labeled **AGENT preview runner** (not an existing production app), with **Repository permissions: Actions → Read and write** and required Metadata: Read. Do not grant Contents: Write, Workflows: Write, Administration, Secrets, Issues, Pull requests or organization permissions.
3. Install it with **Only select repositories**, selecting **`Premieros/agent` exclusively**. Do not install on `All repositories`.
4. Record the numeric **App ID** and **Installation ID**, and generate a private key. Keep the key private and do not paste it into ChatGPT or source.
5. In the **AGENT Vercel project only**, add encrypted **Preview** environment variables scoped to git branch `dev/multifile-work-engine-20261020`:
   - `AGENT_GITHUB_APP_ID`: dedicated test app ID
   - `AGENT_GITHUB_APP_INSTALLATION_ID`: selected-repository installation ID
   - `AGENT_GITHUB_APP_PRIVATE_KEY`: the dedicated test app PEM private key
6. Redeploy **only that AGENT preview branch** to make the environment variables available. Production and any other repository remain unchanged.
7. Check GitHub App installation settings after setup: only `Premieros/agent`, Actions read/write, no additional repository permissions. Remove the preview key and uninstall the test app if the scope differs.

## Test after reviewed workflow merge
1. In an AGENT preview account, issue `ابن تطبيق إدارة مخزون`; confirm six files, `model_calls=0`, and draft ZIP with **NOT TESTED** before remote execution.
2. Approve the public-safe GitHub experiment **once**, knowing GitHub run inputs/logs may be public.
3. Check the actual workflow ID and the GitHub run URL are displayed, not just an optimistic success message.
4. Confirm Node TAP `# tests`, `# pass`, `# fail`, `[exit=0]` and the fixed independent acceptance proof `AGENT_INDEPENDENT_ACCEPTANCE_PASSED:inventory`. Confirm ZIP has tested artifacts and no unrequested secrets.
5. Refresh/reopen the browser and confirm owner-only status is restored. Verify a repeated, previously verified request uses 0 new model calls.
6. Negative test: broken implementation must report failure; repaired implementation must preserve all original tests.

## Not part of this connection
- No service-role database key or unattended worker secret.
- No new model API key. Only built-in offline recipes are in scope for first live test.
- No scheduler, production deployment or installation on other repositories.
- Enabling the separate background worker requires a separate security review and explicit credentials approval.

## Rollback
- Remove the three AGENT Preview variables and redeploy the preview branch.
- Revoke/delete the dedicated GitHub App private key and uninstall the test app.
- Do **not** roll back or edit another project. Do not alter the existing production GitHub App.
