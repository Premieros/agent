import test from "node:test";
import assert from "node:assert/strict";
import {createShotPlan,audioCueSheet,elapsedSceneAt} from "../lib/agent-video-pipeline.ts";
const cast=[{id:"cast-1",name:"مريم",appearance:"شعر أسود",wardrobe:"معطف أزرق",voiceLabel:"لهجة مصرية"}];
const scenes=[{id:1,title:"البداية",subtitle:"مريم وصلت للمحطة",speaker:"مريم",duration:6},
 {id:2,title:"المواجهة",subtitle:"مريم تقول الحقيقة",speaker:"مريم",duration:8}];
test("shot plan locks reference character identity with same ID across scenes",()=>{
 const plan=createShotPlan(scenes,cast,{1:"cast-1",2:"cast-1"},"episodes",2,"9:16");
 assert.equal(plan.status,"requires-provider-and-consent");
 assert.deepEqual(plan.shots.map(s=>s.characterId),["cast-1","cast-1"]);
 assert.ok(plan.shots.every(s=>s.videoPrompt.includes("SAME face")));
 assert.ok(plan.shots.every(s=>s.videoPrompt.includes("No slideshow")));
 assert.equal(plan.referencePolicy.photos,"browser-only");
 assert.equal(plan.shots[1].speech.startSeconds,6);
 assert.equal(plan.shots[1].speech.endSeconds,14);
 assert.equal(audioCueSheet(plan)[1].maximumVoiceDurationSeconds,8);
 assert.doesNotMatch(JSON.stringify(plan),/blob:|data:image|https?:\/\//);
});
test("scene timing stays deterministic at boundaries and rejects excessive shot counts",()=>{
 assert.deepEqual(elapsedSceneAt(scenes,6),{sceneId:2,offset:0,start:6,end:14});
 assert.equal(elapsedSceneAt(scenes,2)?.sceneId,1);
 assert.throws(()=>createShotPlan([],cast,{},"reel",1,"16:9"),/INVALID_SHOT_PLAN/);
 assert.throws(()=>createShotPlan(scenes,cast,{},"episodes",0,"16:9"),/INVALID_SHOT_PLAN/);
});
test("provider handoff never claims that assets, voices or movement have been generated",()=>{
 const plan=createShotPlan(scenes,cast,{1:"cast-1"},"short-series",1,"16:9");
 assert.equal(plan.provider,"not-configured");
 assert.equal(plan.shots[1].referenceRequired,false);
 assert.ok(plan.limitations.some(line=>line.includes("not generated")));
});
