import test from "node:test";
import assert from "node:assert/strict";
import {validateImageGenerationRequest} from "../lib/agent-video-image-request.ts";
import {sceneEnvironment} from "../lib/agent-video-image-engine.ts";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("original scene art categories follow Arabic prompts",()=>{
 assert.equal(sceneEnvironment("شاطئ البحر في الإسكندرية"),"sea");
 assert.equal(sceneEnvironment("دخلت المكتب صباحًا"),"interior");
 assert.equal(sceneEnvironment("في الغابة تحت الأشجار"),"nature");
 assert.equal(sceneEnvironment("الصحراء أمام الأهرامات"),"desert");
 assert.equal(sceneEnvironment("الشارع مزدحم بالسيارات"),"city");
});
test("manual AI provider requires user key and explicit per-click charge consent",()=>{
 const v={provider:"openai",model:"gpt-image-1",apiKey:"sk-test-private-only",prompt:"A realistic Egyptian drama keyframe shot",consentToCharges:true};
 assert.equal(validateImageGenerationRequest(v).provider,"openai");
 assert.throws(()=>validateImageGenerationRequest({...v,consentToCharges:false}),/IMAGE_CONSENT_REQUIRED/);
 assert.throws(()=>validateImageGenerationRequest({...v,apiKey:""}),/INVALID_IMAGE_REQUEST/);
 assert.throws(()=>validateImageGenerationRequest({...v,model:"gpt-4.1"}),/INVALID_IMAGE_REQUEST/);
 assert.equal(validateImageGenerationRequest({...v,provider:"gemini",model:"gemini-2.5-flash-image"}).provider,"gemini");
});
test("no provider calls for local image creation; no server API key is used on image route",()=>{
 const art=read("lib/agent-video-image-engine.ts");
 const route=read("app/api/video/generate-image/route.ts");
 assert.doesNotMatch(art,/fetch\s*\(|supabase|process\.env/);
 assert.match(art,/canvas\.toBlob/);
 assert.match(art,/ctx\.drawImage\(portrait/);
 assert.match(route,/keySource:"manual"/);
 assert.match(route,/validateImageGenerationRequest/);
 assert.match(read("lib/agent-video-image-request.ts"),/consentToCharges/);
 assert.doesNotMatch(route,/process\.env|createClient|supabase/);
});
