import test from "node:test";
import assert from "node:assert/strict";
import {exportVideoSession,importVideoSession} from "../lib/agent-video-session.ts";
import {serializeVideoDraft,storyboardFromScript} from "../lib/agent-video-storyboard.ts";
const scenes=storyboardFromScript("مريم وصلت إلى القطار. وبعد وقت قصير خرجت من المحطة.",30,2);
const cast=[{id:"one",name:"مريم",appearance:"فتاة",wardrobe:"معطف",voiceLabel:"صوت مصري"},
 {id:"two",name:"يوسف",appearance:"شاب",wardrobe:"قميص",voiceLabel:"صوت عميق"}];
test("save and restore all serializable episodic data and scene casting without private media",()=>{
 const output=exportVideoSession("الرحلة","9:16",scenes,cast,{1:"one",2:"two"},"episodes",9);
 const restored=importVideoSession(output);
 assert.equal(restored.mode,"episodes");
 assert.equal(restored.episode,9);
 assert.deepEqual(restored.cast?.map(c=>c.name),["مريم","يوسف"]);
 assert.equal(restored.casting?.[1],"cast-1");
 assert.equal(restored.casting?.[2],"cast-2");
 assert.equal(restored.draft.scenes.length,2);
 assert.doesNotMatch(output,/blob:|data:image|data:audio|data:video/);
});
test("legacy v2 draft is still supported",()=>{
 const old=serializeVideoDraft("قبل التحديث","16:9",scenes);
 const result=importVideoSession(old);
 assert.equal(result.cast,null);assert.equal(result.mode,null);assert.equal(result.draft.name,"قبل التحديث");
});
test("invalid modes, casting IDs and versions are constrained",()=>{
 const v=JSON.parse(exportVideoSession("حكاية","9:16",scenes,cast,{},"reel",1));
 v.casting={"1":"outside","2":"cast-2"};
 assert.deepEqual(importVideoSession(JSON.stringify(v)).casting,{2:"cast-2"});
 v.mode="invalid";
 assert.throws(()=>importVideoSession(JSON.stringify(v)),/INVALID_VIDEO_SESSION/);
 assert.throws(()=>exportVideoSession("x","9:16",scenes,cast,{},"episodes",0),/INVALID_VIDEO_SESSION/);
});
