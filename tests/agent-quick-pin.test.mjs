import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createQuickPin,checkQuickPin,normalizePin,validPin,parseQuickPin,
 quickPinKey,PIN_ATTEMPT_LIMIT,PIN_BLOCK_MS} from "../lib/quick-pin.ts";

const account="10000000-0000-4000-8000-000000000001";
const account2="10000000-0000-4000-8000-000000000002";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("accepts exactly four digits including Arabic keyboard digits",()=>{
 assert.equal(normalizePin("١٢٣٤"),"1234");
 assert.equal(normalizePin("۱۲۳۴"),"1234");
 assert.equal(normalizePin("a12-34-56"),"1234");
 assert.equal(validPin("0000"),true);
 assert.equal(validPin("123"),false);
 assert.equal(validPin("12345"),false);
 assert.equal(validPin("a234"),false);
});

test("PIN is salted, account-bound, and never persisted in plaintext",async()=>{
 const a=await createQuickPin("2580",account);
 const b=await createQuickPin("2580",account);
 assert.notEqual(a.salt,b.salt);
 assert.notEqual(a.verifier,b.verifier);
 assert.equal(JSON.stringify(a).includes("2580"),false);
 assert.equal(quickPinKey(account).includes(account),true);
 assert.equal(parseQuickPin(JSON.stringify(a))?.verifier,a.verifier);
 assert.equal((await checkQuickPin("2580",account,a)).ok,true);
 assert.equal((await checkQuickPin("2580",account2,a)).ok,false);
});

test("five wrong attempts cause a local fifteen minute lockout",async()=>{
 let record=await createQuickPin("1234",account);
 const now=1000000000;
 for(let i=0;i<PIN_ATTEMPT_LIMIT;i++){
  const result=await checkQuickPin("4321",account,record,now);
  assert.equal(result.ok,false);record=result.record;
 }
 assert.equal(record.failedAttempts,PIN_ATTEMPT_LIMIT);
 assert.equal(record.blockedUntil,now+PIN_BLOCK_MS);
 assert.equal((await checkQuickPin("1234",account,record,now+1000)).ok,false);
 const recovered=await checkQuickPin("1234",account,record,now+PIN_BLOCK_MS+1);
 assert.equal(recovered.ok,true);
 assert.equal(recovered.record.failedAttempts,0);
});

test("corrupt or invalid local PIN records are discarded",()=>{
 assert.equal(parseQuickPin("not json"),null);
 assert.equal(parseQuickPin(JSON.stringify({version:1,salt:"abc"})),null);
 assert.throws(()=>quickPinKey("../escape"));
});

test("PIN never creates authenticated sessions or bypasses server permissions",()=>{
 const ui=read("components/quick-pin-control.tsx");
 const shell=read("components/workspace-shell.tsx");
 const server=read("lib/agent-server.ts");
 assert.match(ui,/currentSession\(db\)/);
 assert.match(ui,/db\.auth\.getUser\(session\.access_token\)/);
 assert.match(ui,/db\.auth\.signOut\(\)/);
 assert.doesNotMatch(ui,/signInWithPassword|signInWithOtp|service_role|setSession|refresh_token/);
 assert.match(shell,/<QuickPinControl\/>/);
 assert.match(server,/db\.auth\.getUser\(token\)/);
 assert.match(server,/organization_members/);
});

test("new PIN does not alter existing two-site Support AI routes",()=>{
 const shell=read("components/workspace-shell.tsx");
 assert.match(shell,/\/support\/channels/);
 assert.match(shell,/\/support\/conversations/);
 assert.match(read("app/layout.tsx"),/quick-pin\.css/);
 for(const route of ["app/api/support/premier-inbox/route.ts",
   "app/api/support/johna-inbox/route.ts",
   "app/api/support/public/messages/route.ts"]){
  assert.ok(read(route).length>200,route);
 }
});
