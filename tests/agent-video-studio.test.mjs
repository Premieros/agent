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
 assert.match(studio,/صور الشخصيات والصوت محلية/);
});

test("image search is restricted to licensed Commons assets behind the AGENT API",()=>{
 const search=read("app/api/video/images/route.ts");
 const image=read("app/api/video/image/route.ts");
 assert.match(search,/commons\.wikimedia\.org\/w\/api\.php/);
 assert.match(search,/allowedCommonsLicense/);
 assert.match(search,/CC BY/);
 assert.match(search,/descriptionurl/);
 assert.match(image,/hostname!=="upload\.wikimedia\.org"/);
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

test("narration from uploaded file or microphone is connected and played during export",()=>{
 const studio=read("components/agent-video-studio.tsx");
 assert.match(studio,/if\(audioUrl\)\{\s*const audio=new Audio\(audioUrl\)/);
 assert.match(studio,/run\.audio=audio/);
 assert.match(studio,/createMediaElementSource\(run\.audio\)/);
 assert.match(studio,/voiceGain\.connect\(audioMix\)/);
 assert.match(studio,/await run\.audio\.play\(\)/);
 assert.match(studio,/paint\(canvas,scenes,images\.current,0,photos\.current,casting,cast\)/);
});

test("three real production profiles and per-scene locked reference portraits",()=>{
 const studio=read("components/agent-video-studio.tsx");
 const production=read("lib/agent-video-production.ts");
 assert.match(production,/reel:\{name:"ريل سريع"/);
 assert.match(production,/"short-series":\{name:"مسلسل قصير"/);
 assert.match(production,/episodes:\{name:"مسلسل متعدد الحلقات"/);
 assert.match(studio,/const \[cast,setCast\]=useState<AgentVideoCharacter\[\]>/);
 assert.match(studio,/const \[casting,setCasting\]=useState<Record<number,string>>/);
 assert.match(studio,/characterPhotos\.get\(actorId\)/);
 assert.match(studio,/actorPhoto\.naturalWidth/);
 assert.match(studio,/getCastForScenes\(planned,cast,cast\[0\]\?\.id\)/);
 assert.match(studio,/uploadCastPhoto\(character.id,e\)/);
 assert.match(studio,/previewArabicVoice\(clip.subtitle\)/);
 assert.match(studio,/تحويل الصور إلى ممثلين متحركين/);
 assert.doesNotMatch(production,/fetch\s*\(|createClient|supabase|https?:\/\//);
});
