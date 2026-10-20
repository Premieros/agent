import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("GitHub Actions executes demo code in unprivileged offline Docker without secrets",()=>{
  const workflow=read(".github/workflows/agent-experiment.yml");
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/permissions: \{\}/);
  assert.match(workflow,/timeout-minutes: 4/);
  assert.match(workflow,/--network none --read-only --cap-drop ALL/);
  assert.match(workflow,/--security-opt no-new-privileges --pids-limit 64/);
  assert.match(workflow,/--user 65534:65534/);
  assert.match(workflow,/node --check \/workspace\/work\.js/);
  assert.match(workflow,/node \/workspace\/work\.js/);
  assert.match(workflow,/project_b64:/);
  assert.match(workflow,/node --test/);
  assert.doesNotMatch(workflow,/actions\/checkout@|secrets\.[A-Z_]|GITHUB_TOKEN|npm install|git push/);
});
test("AGENT mints scoped GitHub App installation tokens on the server only",()=>{
  const file=read("lib/agent-github-actions.ts");
  assert.match(file,/import "server-only"/);
  assert.match(file,/AGENT_ACTIONS_REPO="Premieros\/agent"/);
  assert.match(file,/permissions:\{actions:"write"\}/);
  assert.match(file,/repositories:\["agent"\]/);
  assert.match(file,/AGENT_GITHUB_APP_PRIVATE_KEY/);
  assert.match(file,/\/dispatches"/);
  assert.match(file,/workflow_runs\|\|\[\]/);
  assert.match(file,/display_title\?\.includes\(requestId\)/);
  assert.doesNotMatch(file,/GITHUB_TOKEN|service_role|NEXT_PUBLIC_GITHUB/);
});
test("GitHub executor is opt-in, preserves real user identity and won't silently call Vercel",()=>{
  const work=read("app/api/assistant/work/route.ts");
  assert.match(work,/requireAgentSession\(req\)/);
  assert.match(work,/body\.runner!=="sandbox"/);
  assert.match(work,/if\(useGitHub&&!githubActionsConfigured\(\)\)/);
  assert.match(work,/\.eq\("user_id",userId\)/);
  assert.match(work,/connector_id","github"/);
  assert.match(work,/dispatchAgentExperiment\(\{requestId,code:run\.code as string\}\)/);
  assert.match(work,/github_request_id:requestId/);
  assert.match(work,/fetchAgentExperiment\(/);
  assert.match(work,/\.is\("github_request_id",null\)/);
  const migration=read("supabase/migrations/20261020_agent_github_actions_runs.sql");
  assert.match(migration,/add column if not exists github_request_id uuid/);
});
test("GitHub Actions queue is visible in the existing AGENT mini-terminal",()=>{
  const chat=read("components/general-assistant.tsx");
  assert.match(chat,/workRunner,setWorkRunner/);
  assert.match(chat,/value="github">GitHub Actions/);
  assert.match(chat,/runner:workRunner/);
  assert.match(chat,/result\.status==="github_running"/);
  assert.match(chat,/4300/);
  assert.match(chat,/window\.confirm\("سيرسل AGENT كود التجربة/);
  assert.match(chat,/pendingWork\.github_run_id/);
  assert.match(chat,/Vercel Sandbox \(بديل بموافقتك\)/);
});
test("github App setup is explained but not represented as connected without testing",()=>{
  const panel=read("components/github-connection-panel.tsx");
  assert.match(panel,/actionsInfo\?\.configured/);
  assert.match(panel,/AGENT_GITHUB_APP_INSTALLATION_ID/);
  assert.match(panel,/نجاح التفويض لا يتأكد إلا عند تشغيل تجربة/);
  const api=read("app/api/assistant/github-actions/route.ts");
  assert.match(api,/requireAgentSession\(req\)/);
  assert.match(api,/githubActionsConfigured\(\)/);
  assert.doesNotMatch(api,/process\.env\.[A-Z_]+.*return/);
});
