import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("only chat, connections and library are primary navigation",()=>{
  const shell=read("components/workspace-shell.tsx");
  for(const route of ["/assistant","/assistant/integrations","/assistant/library"])
    assert.ok(shell.includes('href:"'+route+'"'));
  assert.equal((shell.match(/href:"\/assistant(?:\/(?:integrations|library))?"/g)||[]).length,3);
  assert.doesNotMatch(shell,/href:"\/studio"/);
  assert.doesNotMatch(shell,/href:"\/crm"/);
  assert.match(read("app/page.tsx"),/redirect\("\/assistant"\)/);
});

test("private library storage includes organization and user authorization",()=>{
  const sql=read("supabase/migrations/20261020_agent_library.sql");
  assert.match(sql,/public\.assistant_library_items/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/bucket_id='agent-library'/);
  assert.match(sql,/storage\.foldername\(name\)/);
  assert.match(sql,/file_size_limit,allowed_mime_types/);
  assert.doesNotMatch(sql,/public',true|public\s*=\s*true/i);
});

test("library API validates ownership and uses private signed URLs",()=>{
  const api=read("app/api/assistant/library/route.ts");
  assert.match(api,/requireAgentSession\(req\)/);
  assert.match(api,/createSignedUrl\(item\.storage_path,300\)/);
  assert.match(api,/eq\("user_id",s\.userId\)/);
  assert.match(api,/ownThread\(s,data\.threadId\)/);
  assert.match(api,/file\.size>MAX/);
  assert.match(api,/MAX=8\*1024\*1024/);
  assert.match(api,/mimeKinds/);
  assert.doesNotMatch(api,/service_role|SUPABASE_SERVICE_ROLE_KEY|createPublicUrl/);
});

test("chat provides explicit save to library and keeps backend permissions",()=>{
  const chat=read("components/general-assistant.tsx");
  assert.match(chat,/saveMessageToLibrary/);
  assert.match(chat,/uploadChatFile/);
  assert.match(chat,/action:"save_message"/);
  assert.match(chat,/مكتبة/);
});

test("selected library documents are read only after checking same-user ownership",()=>{
  const api=read("app/api/assistant/route.ts");
  assert.match(api,/libraryItemId/);
  assert.match(api,/eq\("organization_id",organizationId\)/);
  assert.match(api,/eq\("user_id",userId\)/);
  assert.match(api,/UNTRUSTED_LIBRARY_DOCUMENT/);
  assert.match(api,/file\.data\.size_bytes>100000/);
  assert.match(api,/storage\.from\("agent-library"\)\.download/);
  const chat=read("components/general-assistant.tsx");
  assert.match(chat,/libraryItemId:selectedLibraryFile/);
  assert.match(chat,/openLibraryDocuments/);
});
test("connections have one edit surface, with in-chat status reading only",()=>{
  const panel=read("components/assistant-workspace-panel.tsx");
  assert.doesNotMatch(panel,/toggleConnector\(/);
  assert.match(panel,/href="\/assistant\/integrations"/);
  assert.match(panel,/حالة الربط للقراءة فقط/);
});
