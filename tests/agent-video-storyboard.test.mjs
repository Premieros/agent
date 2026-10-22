import test from "node:test";
import assert from "node:assert/strict";
import {
 storyboardFromScript,serializeVideoDraft,parseVideoDraft,videoSrt,
 videoDuration,splitVideoScript,safeCommonsUrl,guessImageQuery
} from "../lib/agent-video-storyboard.ts";
const script="في القاهرة بدأت حكاية جديدة. تقابل شاب وفتاة في المقهى وسط المدينة.\nانكشف سر قديم غيّر طريقهم، وقرر الأصدقاء العودة إلى المدرسة. بعدها سافروا إلى الإسكندرية وشاهدوا البحر، وفي النهاية رجعوا إلى البيت.";
test("Arabic story becomes the exact number of clips the owner selected",()=>{
 for(const count of [1,3,5,8,16,32]){
  const scenes=storyboardFromScript(script,180,count);
  assert.equal(scenes.length,count);
  assert.equal(videoDuration(scenes),Math.min(180,count*45));
  assert.deepEqual(scenes.map(x=>x.id),Array.from({length:count},(_,i)=>i+1));
  assert.ok(scenes.every(x=>x.subtitle.length>0&&x.duration>=3&&x.duration<=45));
 }
});
test("story beat extraction and Arabic Commons image keyword hints",()=>{
 assert.equal(guessImageQuery("ذهبت الفتاة إلى مطعم"),"restaurant dining");
 assert.equal(guessImageQuery("ذهبنا إلى الإسكندرية"),"Alexandria Egypt");
 assert.ok(splitVideoScript(script).length>=3);
 assert.throws(()=>storyboardFromScript("قصير جدًا",180,3),/SCRIPT_TOO_SHORT/);
});
test("safe project saves licensed remote photo references and never raw uploaded blobs",()=>{
 const scenes=storyboardFromScript(script,90,4);
 const photo="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/test.jpg/800px-test.jpg";
 scenes[0].imageUrl=photo;scenes[0].imageLicense="CC BY-SA 4.0";
 scenes[1].imageUrl="blob:http://localhost/unsafe";
 const serialized=serializeVideoDraft("حكاية", "9:16",scenes);
 assert.doesNotMatch(serialized,/blob:/);
 const loaded=parseVideoDraft(serialized);
 assert.equal(loaded.scenes.length,4);
 assert.equal(loaded.scenes[0].imageUrl,photo);
 assert.equal(loaded.scenes[1].imageUrl,undefined);
 assert.equal(loaded.name,"حكاية");
 assert.equal(safeCommonsUrl("https://evil.example.org/a.jpg"),false);
 assert.equal(safeCommonsUrl(photo),true);
 const altered=JSON.parse(serialized);
 altered.scenes[0].imageUrl="https://invalid.example/a.jpg";
 assert.equal(parseVideoDraft(JSON.stringify(altered)).scenes[0].imageUrl,undefined);
});
test("caption export is timestamped SRT and matches scene count",()=>{
 const scenes=storyboardFromScript(script,180,8);
 const srt=videoSrt(scenes);
 assert.match(srt,/1\n00:00:00,100 -->/);
 assert.equal((srt.match(/-->/g)||[]).length,8);
 assert.match(srt,/00:02:/);
});
