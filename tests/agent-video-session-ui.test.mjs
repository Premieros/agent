import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("record dialogue per scene; independent from full narration and private to browser",()=>{
 const source=read("components/agent-video-studio.tsx");
 assert.match(source,/recordVoice=async\(sceneId:number\|null=null\)/);
 assert.match(source,/sceneVoices\.current\.set\(sceneId,\{url,name:/);
 assert.match(source,/onClick=\{\(\)=>void recordVoice\(clip\.id\)\}/);
 assert.match(source,/setRecordingSceneId\(null\)/);
 assert.match(source,/importVideoSession\(await file\.text\(\)\)/);
 assert.match(source,/exportVideoSession\(name,ratio,scenes,cast,casting,productionMode,episode\)/);
 assert.match(source,/nextId\.current=Math\.max\(/);
 assert.match(source,/video\.loop=true/);
});
test("audio sources are not started before video recording begins",()=>{
 const source=read("components/agent-video-studio.tsx");
 assert.match(source,/recorder\.start\(300\)/);
 assert.match(source,/if\(scheduleAudio&&run\.audioContext\) scheduleAudio\(run\.audioContext\.currentTime\+\.15\)/);
 assert.match(source,/const started=performance\.now\(\)\+150/);
 assert.match(source,/node\.start\(base\+cursor,0,Math\.min\(voice\.buffer\.duration,clip\.duration\)\)/);
 const soundtrack=read("lib/agent-video-soundtrack.ts");
 assert.match(soundtrack,/startAt=context\.currentTime/);
 assert.match(soundtrack,/Math\.max\(context\.currentTime,startAt\)/);
});
