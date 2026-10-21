import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("video studio is linked into the AGENT workspace instead of another repository",()=>{
 const shell=read("components/workspace-shell.tsx");
 const page=read("app/video/page.tsx");
 assert.match(shell,/href:"\/video",label:"صناعة الفيديو"/);
 assert.match(shell,/pathname==="\/video"/);
 assert.match(page,/AgentVideoStudio/);
});
test("local video rendering must not touch AGENT or any other Supabase project",()=>{
 const studio=read("components/agent-video-studio.tsx");
 assert.match(studio,/canvas\.captureStream\(24\)/);
 assert.match(studio,/new MediaRecorder/);
 assert.match(studio,/createMediaStreamDestination/);
 assert.match(studio,/MediaStream\(\[\.\.\.stream\.getVideoTracks\(\),\.\.\.audioTracks\]\)/);
 assert.match(studio,/video\/webm/);
 assert.match(studio,/audio\/\*/);
 assert.match(studio,/image\/png,image\/jpeg,image\/webp/);
 assert.doesNotMatch(studio,/fetch\s*\(|createClient|supabase\.|https?:\/\//);
 assert.doesNotMatch(studio,/GEMINI_API_KEY|OPENROUTER_API_KEY|process\.env/);
});
test("video studio is editable, multiclip and defaults to a local, non-AI experience",()=>{
 const studio=read("components/agent-video-studio.tsx");
 assert.match(studio,/const MAX_SCENES=12/);
 assert.match(studio,/const \[scenes,setScenes\]=useState/);
 assert.match(studio,/const \[ratio,setRatio\]=useState<Ratio>\("9:16"\)/);
 assert.match(studio,/setScenes\(old=>old\.map/);
 assert.match(studio,/type="file"/);
 assert.match(studio,/بدون مفتاح API أو رسوم توليد/);
 assert.match(studio,/لا يتم رفع صورك أو صوتك إلى الخادم/);
});
