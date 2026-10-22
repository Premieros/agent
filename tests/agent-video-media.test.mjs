import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("browser studio accepts motion clips without ever posting private reference images",()=>{
 const c=read("components/agent-video-studio.tsx");
 assert.match(c,/const shotVideos=useRef<Map<number,HTMLVideoElement>>/);
 assert.match(c,/accept="video\/mp4,video\/webm"/);
 assert.match(c,/ctx\.drawImage\(video,/);
 assert.match(c,/syncShotVideos\(seconds,true\)/);
 assert.match(c,/!movingFrame&&actorPhoto/);
 assert.match(c,/shotVideos\.current\.get\(id\)\?\.pause\(\)/);
 assert.doesNotMatch(c,/fetch\("https?:\/\//);
});
test("local dialogue is decoded, timed, mixed into the captured export and bounded to each scene",()=>{
 const c=read("components/agent-video-studio.tsx");
 assert.match(c,/sceneVoices=useRef<Map<number,/);
 assert.match(c,/context\.decodeAudioData/);
 assert.match(c,/node\.start\(base\+cursor,0,Math\.min\(voice\.buffer\.duration,clip\.duration\)\)/);
 assert.match(c,/gain\.connect\(audioMix\)/);
 assert.match(c,/if\(!run\.completed\)return/);
 assert.match(c,/downloadShotPlan/);
 assert.match(c,/downloadCueSheet/);
 const plan=read("lib/agent-video-pipeline.ts");
 assert.doesNotMatch(plan,/fetch\s*\(|createClient|supabase|process\.env/);
 assert.match(plan,/externalUpload:"requires-separate-explicit-consent"/);
});
