import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const chat=read("components/general-assistant.tsx");

test("chat retries a 401 exactly once with refreshed JWT, never bypasses server auth",()=>{
  assert.match(chat,/const apiFetch=useCallback/);
  assert.match(chat,/if\(result\.status!==401\)return result;/);
  assert.match(chat,/await db\.auth\.refreshSession\(\)/);
  assert.match(chat,/headers\.set\("Authorization","Bearer "\+refreshed\.data\.session\.access_token\)/);
  assert.match(chat,/result=await fetch\(url,\{\.\.\.opts,headers\}\)/);
  assert.match(chat,/if\(result\.status!==401\)\{setSessionExpired\(false\);return result;\}/);
  assert.match(chat,/setSessionExpired\(true\)/);
  assert.doesNotMatch(chat,/SUPABASE_SERVICE_ROLE_KEY|service_role|anon.*bypass/);
});
test("protected requests use recovered fetch and multipart body keeps browser boundary",()=>{
  assert.match(chat,/if\(init\?\.body instanceof FormData\)headers\.delete\("Content-Type"\)/);
  assert.ok((chat.match(/await apiFetch\(/g)||[]).length>=20);
  assert.match(chat,/const headers=await authHeaders\(\)/);
  assert.match(chat,/if\(!session\?\.access_token\)\{setSessionExpired\(true\)/);
});
test("session expiry has an explicit retry and login path while retaining draft for copy",()=>{
  assert.match(chat,/className="assistant-session-banner"/);
  assert.match(chat,/onClick=\{\(\)=>void retrySession\(\)\}/);
  assert.match(chat,/href="\/crm"/);
  assert.match(chat,/navigator\.clipboard\.writeText\(draft\)/);
  assert.match(chat,/setDraft\(message\)/);
  assert.match(chat,/disabled=\{Boolean\(busy\)\|\|sessionExpired\|\|!draft\.trim\(\)\}/);
});
test("sign-out clears confidential conversation data and old studio UI",()=>{
  assert.match(chat,/onAuthStateChange/);
  assert.match(chat,/event==="SIGNED_OUT"/);
  assert.match(chat,/setThreads\(\[\]\);setThreadId\(""\);setMessages\(\[\]\)/);
  assert.match(chat,/setActiveArea\(null\);setShowStudioControls\(false\)/);
  assert.match(chat,/messages\.length>0&&activeArea==="studio"/);
});
test("new chat UI is not cleared before create is authorized",()=>{
  const fn=chat.slice(chat.indexOf("async function createThread()"),chat.indexOf("async function removeThread"));
  assert.ok(fn.indexOf('if(!res.ok||!data.thread)')<fn.indexOf('setShowStudioControls(false)'));
  assert.ok(fn.indexOf('if(!res.ok||!data.thread)')<fn.indexOf('setThreadId(data.thread.id)'));
  assert.match(read("app/workspace-dark.css"),/\.assistant-session-banner/);
});
