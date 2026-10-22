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
 assert.match(studio,/fetch\("\/api\/video\/images\?q="/);
 assert.doesNotMatch(studio,/createClient|supabase\.|https?:\/\//);
 assert.match(studio,/startAmbientSoundtrack/);
 assert.doesNotMatch(studio,/GEMINI_API_KEY|OPENROUTER_API_KEY|process\.env/);
});
test("video studio is editable, multiclip and defaults to a local, non-AI experience",()=>{
 const studio=read("components/agent-video-studio.tsx");
 assert.match(studio,/const MAX_SCENES=MAX_VIDEO_SCENES/);
 assert.match(studio,/const \[scenes,setScenes\]=useState/);
 assert.match(studio,/const \[ratio,setRatio\]=useState<Ratio>\("9:16"\)/);
 assert.match(studio,/setScenes\(old=>old\.map/);
 assert.match(studio,/type="file"/);
 assert.match(studio,/بدون مفتاح API أو رسوم توليد/);
 assert.match(studio,/لا يتم رفع صورك أو صوتك إلى الخادم/);
});

test("image search is restricted to licensed Commons assets behind the AGENT API",()=>{
 const search=read("app/api/video/images/route.ts");
 const image=read("app/api/video/image/route.ts");
 assert.match(search,/commons\.wikimedia\.org\/w\/api\.php/);
 assert.match(search,/allowedCommonsLicense/);
 assert.match(search,/CC BY/);
 assert.match(search,/descriptionurl/);
 assert.match(image,/hostname==="upload\.wikimedia\.org"/);
 assert.match(image,/redirect:"error"/);
 assert.match(image,/MAX_IMAGE_BYTES=8\*1024\*1024/);
 assert.doesNotMatch(image,/process\.env\.(?!NODE_ENV)/);
});
test("the exported video contains an original audio track or user narration",()=>{
 const studio=read("components/agent-video-studio.tsx");
 const soundtrack=read("lib/agent-video-soundtrack.ts");
 assert.match(studio,/createMediaStreamDestination/);
 assert.match(studio,/startAmbientSoundtrack/);
 assert.match(studio,/new MediaStream\(\[\.\.\.stream\.getVideoTracks\(\),\.\.\.audioTracks\]\)/);
 assert.match(studio,/navigator\.mediaDevices\.getUserMedia/);
 assert.match(soundtrack,/oscillator\.connect\(envelope\)/);
 assert.doesNotMatch(soundtrack,/https?:\/\/|fetch\s*\(|supabase/);
});
