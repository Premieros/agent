/**
 * Real Chromium acceptance test: renders an actual moving WebM source, checks
 * microphone scene recording and exports a playable-duration WebM via AGENT.
 * Browser and Next server remain local; there are no image provider / AI calls.
 */
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,statSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {chromium} from "playwright";

const base="http://127.0.0.1:3189";
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3189"],{
 cwd:process.cwd(),env:{...process.env,NEXT_TELEMETRY_DISABLED:"1"},stdio:["ignore","pipe","pipe"]
});
let serverOutput="";
for(const stream of [server.stdout,server.stderr]){
 stream.on("data",chunk=>{serverOutput=(serverOutput+chunk.toString()).slice(-6000);});
}
let browser;
const folder=mkdtempSync(join(tmpdir(),"agent-video-browser-"));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function wavTone(){
 const rate=16000,length=rate*2,b=new ArrayBuffer(44+length*2),v=new DataView(b);
 const ascii=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
 ascii(0,"RIFF");v.setUint32(4,36+length*2,true);ascii(8,"WAVE");
 ascii(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);
 v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);
 v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,"data");v.setUint32(40,length*2,true);
 for(let i=0;i<length;i++){
  const envelope=Math.min(1,i/4000)*Math.min(1,(length-i)/4000);
  v.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*220/rate)*envelope*12500),true);
 }
 return Buffer.from(b);
}
try{
 let ready=false;
 for(let i=0;i<80;i++){
  if(server.exitCode!==null)break;
  try{const r=await fetch(base+"/video",{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{}
  await pause(500);
 }
 assert.ok(ready,"AGENT /video HTTP startup failed: "+serverOutput);
 browser=await chromium.launch({headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
 const context=await browser.newContext({acceptDownloads:true,permissions:["microphone"]});
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 page.on("pageerror",error=>{serverOutput+="\nBROWSER: "+error.message;});
 await page.route("**/api/video/images?**",route=>route.fulfill({status:200,contentType:"application/json",body:'{"images":[]}'}));
 await page.goto(base+"/video",{waitUntil:"domcontentloaded"});
 await page.getByRole("heading",{name:/صناعة فيديو من السيناريو/}).waitFor();
 const dur=page.locator("label").filter({hasText:"المدة (3–25 ثانية)"}).locator('input[type="number"]');
 assert.equal(await dur.count(),3);
 for(let i=0;i<3;i++)await dur.nth(i).fill("3");

 // Verify a real PNG was created locally and linked into the video studio.
 await page.getByRole("button",{name:"إنشاء صورة للمشهد (مجاني)"}).first().click();
 const pngButton=page.getByRole("button",{name:"تحميل PNG"}).first();
 await pngButton.waitFor({timeout:20000});
 const [pngDownload]=await Promise.all([page.waitForEvent("download"),pngButton.click()]);
 const pngFile=join(folder,pngDownload.suggestedFilename());
 await pngDownload.saveAs(pngFile);
 const {readFileSync}=await import("node:fs");
 const png=readFileSync(pngFile);
 assert.ok(png.byteLength>1000,"Local scene image not generated");
 assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 console.log("AGENT LOCAL IMAGE PASS",png.byteLength);

 // Exercise the opt-in AI UI with a mocked network response; no provider is charged.
 let requests=0;
 await page.route("**/api/video/generate-image",async route=>{
  const data=route.request().postDataJSON();
  assert.equal(data.provider,"openai");
  assert.equal(data.consentToCharges,true);
  assert.equal(data.model,"gpt-image-1");
  assert.ok(data.prompt.length>30);
  requests++;
  await route.fulfill({status:200,contentType:"image/png",body:png});
 });
 await page.locator("select").filter({has:page.locator('option[value="ai"]')}).selectOption("ai");
 await page.getByPlaceholder("أدخل المفتاح لمرة واحدة في هذه الجلسة").fill("sk-test-browser-manual-only");
 await page.getByText("أوافق على إرسال وصف المشهد").locator('input[type="checkbox"]').check();
 await page.getByRole("button",{name:"إنشاء صورة للمشهد (AI)"}).first().click();
 await page.getByText("تم إنشاء الصورة وإضافتها للمشهد", {exact:false}).waitFor();
 assert.equal(requests,1);
 assert.equal(await page.getByText("أوافق على إرسال وصف المشهد").locator('input[type="checkbox"]').isChecked(),false);
 // Return to the no-cost default for all remaining video testing.
 await page.locator("select").filter({has:page.locator('option[value="ai"]')}).selectOption("local");
 // Produce genuine moving video frames in Chromium without an API or file server.
 const bytes=await page.evaluate(async()=>{
  const canvas=document.createElement("canvas");canvas.width=320;canvas.height=568;
  const ctx=canvas.getContext("2d");if(!ctx)throw Error("NO_CANVAS");
  const draw=(frame)=>{
   ctx.fillStyle=frame%2?"#354ca3":"#b95651";ctx.fillRect(0,0,320,568);
   ctx.fillStyle="#fff";ctx.fillRect((frame*17)%250,100,65,80);
  };
  draw(0);
  const stream=canvas.captureStream(12);
  const type=["video/webm;codecs=vp8","video/webm"].find(m=>MediaRecorder.isTypeSupported(m));
  if(!type)throw Error("WEBM_UNAVAILABLE");
  return await new Promise((resolve,reject)=>{
   const chunks=[],rec=new MediaRecorder(stream,{mimeType:type});
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   rec.onerror=()=>reject(Error("TEST_RECORDER_ERROR"));
   rec.onstop=async()=>{
    stream.getTracks().forEach(track=>track.stop());
    resolve(Array.from(new Uint8Array(await new Blob(chunks,{type}).arrayBuffer())));
   };
   rec.start(100);
   let frame=0;const timer=setInterval(()=>draw(++frame),80);
   setTimeout(()=>{clearInterval(timer);rec.stop();},1450);
  });
 });
 assert.ok(bytes.length>3000,"Synthetic video too small");
 await page.locator('input[type="file"][accept="video/mp4,video/webm"]').first().setInputFiles({
  name:"motion.webm",mimeType:"video/webm",buffer:Buffer.from(bytes)
 });
 // Exercise the microphone path, then use deterministic WAV for mux verification.
 await page.getByRole("button",{name:"تسجيل حوار المشهد من الميكروفون"}).first().click();
 try{
  await page.getByRole("button",{name:"إيقاف تسجيل حوار المشهد"}).first().waitFor({timeout:6000});
 }catch{
  const errors=await page.locator('[role="alert"]').allTextContents();
  const controls=await page.getByRole("button",{name:/تسجيل حوار|إيقاف تسجيل/}).allTextContents();
  throw Error("MIC_CAPTURE_NOT_READY: "+JSON.stringify({errors,controls,
   media:await page.evaluate(()=>({secure:window.isSecureContext,
    mediaDevices:!!navigator.mediaDevices?.getUserMedia,
    mediaRecorder:typeof window.MediaRecorder}))}));
 }
 await pause(1100);
 await page.getByRole("button",{name:"إيقاف تسجيل حوار المشهد"}).first().click();
 await page.getByText("حوار مسجّل: المشهد 1").first().waitFor();
 const firstVoice=page.locator('input[type="file"][accept="audio/*"]').nth(1);
 await firstVoice.setInputFiles({name:"dialogue.wav",mimeType:"audio/wav",buffer:wavTone()});
 await page.getByText("مقاطع حركة فعلية: 1 / 3").waitFor();
 await page.getByText("حوارات عربية مضافة: 1 / 3").waitFor();
 // The browser really records the canvas + decoded Arabic-scene audio.
 await page.getByRole("button",{name:"تصدير الفيديو"}).click();
 const link=page.getByRole("link",{name:"تحميل الفيديو"});
 await link.waitFor({timeout:40000});
 const [download]=await Promise.all([page.waitForEvent("download"),link.click()]);
 const file=join(folder,download.suggestedFilename());
 await download.saveAs(file);
 const size=statSync(file).size;
 assert.ok(size>5000,"Export is empty or missing, size="+size);
 assert.match(download.suggestedFilename(),/\.webm$|\.mp4$/);
 const streams=execFileSync("ffprobe",["-v","error","-show_entries","stream=codec_type",
  "-of","default=noprint_wrappers=1:nokey=1",file],{encoding:"utf8"}).trim().split(/\s+/);
 assert.ok(streams.includes("video"),"Export contains no decodable video stream");
 assert.ok(streams.includes("audio"),"Export contains no decodable audio stream");
 console.log("AGENT VIDEO BROWSER PASS: real frames and dialogue export",{
  bytes:size,file:download.suggestedFilename(),inputBytes:bytes.length,streams
 });
}catch(err){
 console.error("AGENT BROWSER SMOKE FAILED",err,serverOutput.slice(-3000));
 process.exitCode=1;
}finally{
 await browser?.close();
 server.kill("SIGTERM");
 rmSync(folder,{recursive:true,force:true});
}
