"use client";

import {useCallback,useEffect,useRef,useState,type ChangeEvent} from "react";
import {Download,Film,ImagePlus,Music2,Pause,Play,Plus,Trash2,Video,Mic,Save,FileText,RefreshCw} from "lucide-react";
import {storyboardFromScript,videoSrt,
 videoScriptDocument,guessImageQuery,safeCommonsUrl,MAX_VIDEO_SCENES,
 type VideoScene} from "@/lib/agent-video-storyboard";
import {startAmbientSoundtrack} from "@/lib/agent-video-soundtrack";
import {createShotPlan,audioCueSheet,elapsedSceneAt} from "@/lib/agent-video-pipeline";
import {renderSceneArtwork,type ImageSceneStyle} from "@/lib/agent-video-image-engine";
import {exportVideoSession,importVideoSession} from "@/lib/agent-video-session";
import {AGENT_VIDEO_MODES,getCastForScenes,castBibleAsJson,parseCastBible,
 type AgentVideoCharacter,type AgentVideoMode} from "@/lib/agent-video-production";
import s from "./agent-video-studio.module.css";

type Ratio="16:9"|"9:16";
type Scene=VideoScene;
type Run={frame:number;recorder:MediaRecorder|null;stream:MediaStream|null;
 audioContext:AudioContext|null;audio:HTMLAudioElement|null;playing:boolean;completed:boolean;
 voiceNodes:AudioBufferSourceNode[]};
type StudioStep="story"|"design"|"editor"|"export";
const defaults:Scene[]=[
 {id:1,title:"مش من مستوانا",subtitle:"حكاية مصرية تبدأ بلحظة غير متوقعة",speaker:"المشهد الأول",duration:6,color:"#9b4dbb",transition:"cut",imageQuery:"Egypt drama"},
 {id:2,title:"القرار",subtitle:"في لحظة واحدة، كل شيء اتغير.",speaker:"المشهد الثاني",duration:6,color:"#b45358",transition:"fade",imageQuery:"Egypt city"},
 {id:3,title:"المفاجأة",subtitle:"لكن الحقيقة لسه ما ظهرتش...",speaker:"المشهد الثالث",duration:6,color:"#147c86",transition:"fade",imageQuery:"Egypt people"}
];
const MAX_SCENES=MAX_VIDEO_SCENES;
function boundedDuration(value:number){return Number.isFinite(value)?Math.max(3,Math.min(25,Math.round(value))):5;}
function wrap(ctx:CanvasRenderingContext2D,value:string,maxWidth:number,maxLines:number){
 const raw=value.trim().split(/\s+/).filter(Boolean);
 const result:string[]=[];let line="";
 for(const word of raw){
  const next=line?line+" "+word:word;
  if(ctx.measureText(next).width>maxWidth&&line){
   result.push(line);line=word;
  }else line=next;
  if(result.length>=maxLines)break;
 }
 if(line&&result.length<maxLines)result.push(line);
 return result;
}
function paint(canvas:HTMLCanvasElement,scenes:readonly Scene[],images:Map<number,HTMLImageElement>,
 seconds:number,characterPhotos:Map<string,HTMLImageElement>,
 casting:Record<number,string>,characters:readonly AgentVideoCharacter[],
 shotVideos?:Map<number,HTMLVideoElement>){
 const ctx=canvas.getContext("2d");
 if(!ctx||!scenes.length)return;
 const w=canvas.width,h=canvas.height;
 const total=scenes.reduce((n,c)=>n+c.duration,0);
 const selectedScene=scenes.find(clip=>clip.id===selectedSceneId)||scenes[0];
 const fmt=(n:number)=>String(Math.floor(Math.max(0,n)/60)).padStart(2,"0")+":"+
  String(Math.floor(Math.max(0,n)%60)).padStart(2,"0");
 const seekTo=(second:number)=>{
  if(playing)return;
  const at=Math.max(0,Math.min(total,second));
  previewSecond.current=at;setProgress(at);syncShotVideos(at,false);draw(at);
 };
 const selectScene=(id:number)=>{
  if(playing)return;
  setSelectedSceneId(id);
  const seconds=scenes.slice(0,Math.max(0,scenes.findIndex(c=>c.id===id)))
   .reduce((sum,c)=>sum+c.duration,0);
  seekTo(seconds);setStep("editor");
 };
 const time=Math.max(0,Math.min(total,seconds));
 let remaining=time,index=0;
 for(;index<scenes.length-1&&remaining>=scenes[index].duration;index++)
  remaining-=scenes[index].duration;
 const clip=scenes[index],fraction=Math.min(1,remaining/clip.duration);
 const vertical=h>w,unit=Math.min(w,h);
 ctx.clearRect(0,0,w,h);
 const gradient=ctx.createLinearGradient(0,0,w,h);
 gradient.addColorStop(0,"#080d1e");gradient.addColorStop(.52,clip.color);
 gradient.addColorStop(1,"#111426");
 ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
 const video=shotVideos?.get(clip.id);
 const movingFrame=!!(video&&video.readyState>=2&&video.videoWidth>0);
 if(movingFrame&&video){
  ctx.save();
  const scale=Math.max(w/video.videoWidth,h/video.videoHeight);
  const vw=video.videoWidth*scale,vh=video.videoHeight*scale;
  ctx.drawImage(video,(w-vw)/2,(h-vh)/2,vw,vh);
  ctx.restore();
 }
 const photo=images.get(clip.id);
 if(!movingFrame&&photo&&photo.complete&&photo.naturalWidth>0){
  ctx.save();
  const scale=(1+fraction*.055)*Math.max(w/photo.naturalWidth,h/photo.naturalHeight);
  const sw=photo.naturalWidth*scale,sh=photo.naturalHeight*scale;
  ctx.globalAlpha=.70;
  ctx.drawImage(photo,(w-sw)/2,(h-sh)/2,sw,sh);
  ctx.restore();
 }
 // An actor reference is reused verbatim for every scene featuring this character.
 // Commons background search is NEVER used to invent or replace actors.
 const actorId=casting[clip.id],actor=characters.find(c=>c.id===actorId);
 const actorPhoto=actorId?characterPhotos.get(actorId):undefined;
 if(!movingFrame&&actorPhoto&&clip.imageLicense!=="AGENT_LOCAL_ART_WITH_CAST"&&actorPhoto.complete&&actorPhoto.naturalWidth>0){
  ctx.save();
  const aw=vertical?w*.67:w*.32,ah=vertical?h*.56:h*.71;
  const ax=vertical?(w-aw)/2:w*.60,ay=vertical?h*.18:h*.11;
  const scale=Math.max(aw/actorPhoto.naturalWidth,ah/actorPhoto.naturalHeight);
  const cropW=aw/scale,cropH=ah/scale;
  const sx=(actorPhoto.naturalWidth-cropW)/2,sy=(actorPhoto.naturalHeight-cropH)/2;
  ctx.fillStyle="#12182b";ctx.fillRect(ax-7,ay-7,aw+14,ah+14);
  ctx.globalAlpha=.94;
  ctx.drawImage(actorPhoto,sx,sy,cropW,cropH,ax,ay,aw,ah);
  ctx.globalAlpha=1;ctx.strokeStyle="#e8b9ff";ctx.lineWidth=3;
  ctx.strokeRect(ax,ay,aw,ah);
  ctx.restore();
 }
 const overlay=ctx.createLinearGradient(0,0,0,h);
 overlay.addColorStop(0,"rgba(3,8,24,.67)");
 overlay.addColorStop(.48,"rgba(2,7,16,.22)");
 overlay.addColorStop(1,"rgba(3,8,24,.88)");
 ctx.fillStyle=overlay;ctx.fillRect(0,0,w,h);
 ctx.textAlign="center";ctx.direction="rtl";ctx.fillStyle="#f9e4b9";
 ctx.font="700 "+Math.round(unit*(vertical?.041:.04))+"px Cairo,Arial,sans-serif";
 ctx.fillText("AGENT  •  استوديو صناعة الفيديو",w/2,h*.075);
 ctx.fillStyle="#fff";
 ctx.font="800 "+Math.round(unit*(vertical?.09:.095))+"px Cairo,Arial,sans-serif";
 const titleLines=wrap(ctx,clip.title,w*.86,2);
 const top=h*(vertical?.35:.38);
 titleLines.forEach((line,i)=>ctx.fillText(line,w/2,top+i*unit*.12,w*.9));
 ctx.fillStyle="#e9e2e9";
 ctx.font="600 "+Math.round(unit*.047)+"px Cairo,Arial,sans-serif";
 const subtitleLines=wrap(ctx,clip.subtitle,w*.80,4);
 const subtitleTop=top+titleLines.length*unit*.12+unit*.06;
 subtitleLines.forEach((line,i)=>ctx.fillText(line,w/2,subtitleTop+i*unit*.072,w*.87));
 ctx.fillStyle="#f9bbee";
 ctx.font="700 "+Math.round(unit*.036)+"px Cairo,Arial,sans-serif";
 ctx.fillText(actor?.name||clip.speaker,w/2,h*.91);
 ctx.fillStyle="#ffffff55";ctx.fillRect(w*.075,h*.963,w*.85,Math.max(3,h*.006));
 ctx.fillStyle="#e8b9ff";ctx.fillRect(w*.075,h*.963,w*.85*(total?time/total:0),Math.max(3,h*.006));
 ctx.direction="inherit";
}
function recorderMime(){
 if(typeof MediaRecorder==="undefined")return "";
 return ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus",
  "video/webm","video/mp4"].find(type=>MediaRecorder.isTypeSupported(type))||"";
}
export default function AgentVideoStudio(){
 const [scenes,setScenes]=useState<Scene[]>(defaults);
 const [productionMode,setProductionMode]=useState<AgentVideoMode>("reel");
 const [episode,setEpisode]=useState(1);
 const [cast,setCast]=useState<AgentVideoCharacter[]>([
  {id:"cast-1",name:"مريم",appearance:"شابة مصرية في منتصف العشرينات",wardrobe:"ملابس واقعية مناسبة للمشهد",voiceLabel:"صوت مصري هادئ"}
 ]);
 const [casting,setCasting]=useState<Record<number,string>>({1:"cast-1",2:"cast-1",3:"cast-1"});
 const [castNotice,setCastNotice]=useState("");
 const photos=useRef<Map<string,HTMLImageElement>>(new Map());
 const castFileRef=useRef<HTMLInputElement|null>(null);
 const nextCastId=useRef(2);
 const currentMode=AGENT_VIDEO_MODES[productionMode];
 const [name,setName]=useState("مش من مستوانا");
 const [script,setScript]=useState("في شارع مصري هادئ، بدأت حكاية مريم لما سمعت خبراً غير متوقع.\nقررت مريم أن تواجه الحقيقة رغم اعتراض أسرتها.\nكل خطوة كانت تكشف سرًا جديدًا، ولم يكن أحد يتوقع النهاية.");
 const [requestedCount,setRequestedCount]=useState(6);
 const [requestedSeconds,setRequestedSeconds]=useState(45);
 const [imagesBusy,setImagesBusy]=useState(false);
 const [imageNotice,setImageNotice]=useState("");
 const [imageEngine,setImageEngine]=useState<"local"|"ai">("local");
 const [imageStyle,setImageStyle]=useState<ImageSceneStyle>("cinematic");
 const [imageAIProvider,setImageAIProvider]=useState<"openai"|"gemini">("openai");
 const [imageApiKey,setImageApiKey]=useState("");
 const [imageCostConsent,setImageCostConsent]=useState(false);
 const [imageDescriptions,setImageDescriptions]=useState<Record<number,string>>({});
 const [imageEngineBusy,setImageEngineBusy]=useState<number|null>(null);
 const [imageEngineNotice,setImageEngineNotice]=useState("");
 const [createdImageNames,setCreatedImageNames]=useState<Record<number,string>>({});
 const imageVariation=useRef(17);
 const [musicEnabled,setMusicEnabled]=useState(true);
 const [recordingVoice,setRecordingVoice]=useState(false);
 const [recordingSceneId,setRecordingSceneId]=useState<number|null>(null);
 const micSession=useRef<{recorder:MediaRecorder;stream:MediaStream;sceneId:number|null}|null>(null);
 const fileImportRef=useRef<HTMLInputElement|null>(null);
 const [ratio,setRatio]=useState<Ratio>("9:16");
 const [audioUrl,setAudioUrl]=useState<string|null>(null);
 const [audioName,setAudioName]=useState("");
 const [progress,setProgress]=useState(0);
 const [step,setStep]=useState<StudioStep>("story");
 const [selectedSceneId,setSelectedSceneId]=useState(1);
 const previewSecond=useRef(0);
 const [playing,setPlaying]=useState(false);
 const [recording,setRecording]=useState(false);
 const [downloadUrl,setDownloadUrl]=useState<string|null>(null);
 const [downloadType,setDownloadType]=useState("video/webm");
 const [error,setError]=useState("");
 const [imageTick,setImageTick]=useState(0);
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const images=useRef<Map<number,HTMLImageElement>>(new Map());
 const shotVideos=useRef<Map<number,HTMLVideoElement>>(new Map());
 const [shotVideoNames,setShotVideoNames]=useState<Record<number,string>>({});
 const sceneVoices=useRef<Map<number,{url:string;name:string}>>(new Map());
 const [sceneVoiceNames,setSceneVoiceNames]=useState<Record<number,string>>({});
 const urls=useRef<string[]>([]);
 const nextId=useRef(4);
 const running=useRef<Run|null>(null);
 const total=scenes.reduce((n,c)=>n+c.duration,0);

 const draw=useCallback((second:number)=>{
  if(canvasRef.current)paint(canvasRef.current,scenes,images.current,second,
   photos.current,casting,cast,shotVideos.current);
 },[scenes,cast,casting]);
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  canvas.width=ratio==="9:16"?540:960;
  canvas.height=ratio==="9:16"?960:540;
  draw(previewSecond.current);
 },[ratio,draw,imageTick]);
 useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);
  shotVideos.current.forEach(video=>{video.pause();video.removeAttribute("src");video.load();});
  const mic=micSession.current;if(mic){if(mic.recorder.state!=="inactive")mic.recorder.stop();mic.stream.getTracks().forEach(t=>t.stop());}
  const run=running.current;if(run){cancelAnimationFrame(run.frame);
   if(run.recorder&&run.recorder.state!=="inactive")run.recorder.stop();
   run.audio?.pause();run.stream?.getTracks().forEach(track=>track.stop());
   void run.audioContext?.close();
  }
 },[]);

 const chooseMode=(mode:AgentVideoMode)=>{
  if(playing||imagesBusy)return;
  setProductionMode(mode);
  setRequestedCount(AGENT_VIDEO_MODES[mode].defaultCount);
  setRequestedSeconds(AGENT_VIDEO_MODES[mode].defaultDuration);
  setError("");setDownloadUrl(null);
 };
 const addCastMember=()=>{
  if(cast.length>=15||playing)return;
  const id="cast-"+nextCastId.current++;
  setCast(old=>[...old,{id,name:"شخصية جديدة",appearance:"",wardrobe:"",voiceLabel:"صوت عربي"}]);
 };
 const editCast=(id:string,patch:Partial<AgentVideoCharacter>)=>{
  if(playing)return;
  setCast(old=>old.map(item=>item.id===id?{...item,...patch}:item));
  setDownloadUrl(null);
 };
 const uploadCastPhoto=(id:string,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){
   setError("صورة الشخصية يجب أن تكون PNG أو JPEG أو WebP وأقل من 10 ميجابايت.");return;
  }
  const url=URL.createObjectURL(file);urls.current.push(url);
  const img=new Image();
  img.onload=()=>{photos.current.set(id,img);setImageTick(t=>t+1);
   setCastNotice("تم تثبيت صورة الشخصية، وستظهر نفسها في كل مشهد مرتبط بها.");};
  img.onerror=()=>setError("تعذر قراءة الصورة المرجعية للشخصية.");
  img.src=url;
 };
 const importCast=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];
  if(!file)return;
  try{
   if(file.size>30000)throw Error("too large");
   const result=parseCastBible(await file.text());
   setCast(result);photos.current.clear();setCasting({});
   nextCastId.current=result.length+1;
   setCastNotice("تم استعادة أوصاف الشخصيات. أعد رفع صورة كل شخصية لضمان ثبات الوجه.");
   setImageTick(t=>t+1);
  }catch{setError("ملف الشخصيات غير صالح.");}
  event.target.value="";
 };
 const previewArabicVoice=(text:string)=>{
  if(typeof window==="undefined"||!("speechSynthesis" in window)){
   setError("المتصفح لا يدعم القراءة الآلية؛ استخدم تسجيل الصوت أو ارفع ملفًا.");return;
  }
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text.slice(0,450));
  utterance.lang="ar-EG";utterance.rate=.93;
  const voices=window.speechSynthesis.getVoices();
  const voice=voices.find(v=>v.lang.toLowerCase().startsWith("ar"));
  if(voice)utterance.voice=voice;
  window.speechSynthesis.speak(utterance);
  setCastNotice("دي معاينة صوت فقط. صوت المتصفح الآلي لا يُدمج في ملف الفيديو؛ للتصدير ارفع أو سجّل التعليق.");
 };
 const createSceneImage=async(clip:Scene,allLocal=false)=>{
  if(playing||imagesBusy||imageEngineBusy!==null)return false;
  setError("");setImageEngineNotice("");
  const local=allLocal||imageEngine==="local";
  if(!local&&(!imageCostConsent||imageApiKey.trim().length<12)){
   setError("توليد الصور بالذكاء الاصطناعي يتطلب مفتاحك الخاص وموافقة صريحة على تكلفة هذا الطلب.");return false;
  }
  setImageEngineBusy(clip.id);
  try{
   let blob:Blob;
   const reference=photos.current.get(casting[clip.id]||"");
   const scenePrompt=(imageDescriptions[clip.id]||"").trim().slice(0,400);
   if(local){
    blob=await renderSceneArtwork({sceneId:clip.id,title:clip.title,
     subtitle:scenePrompt||clip.subtitle,style:imageStyle,aspect:ratio,
     seed:imageVariation.current++},reference);
   }else{
    const plan=createShotPlan([clip],cast,casting,productionMode,episode,ratio);
    const prompt=(plan.shots[0].imagePrompt+
     (scenePrompt?" Visual art direction: "+scenePrompt:"")+
     " Produce one single coherent scene keyframe without typography.").slice(0,2000);
    const response=await fetch("/api/video/generate-image",{
     method:"POST",headers:{"Content-Type":"application/json"},
     cache:"no-store",body:JSON.stringify({provider:imageAIProvider,
      model:imageAIProvider==="openai"?"gpt-image-1":"gemini-2.5-flash-image",
      apiKey:imageApiKey.trim(),consentToCharges:true,prompt})
    });
    if(!response.ok){
     const value=await response.json().catch(()=>({error:"IMAGE_GENERATION_FAILED"})) as {error?:string};
     throw Error(value.error||"IMAGE_GENERATION_FAILED");
    }
    const type=response.headers.get("content-type")?.split(";")[0]||"";
    if(!["image/png","image/jpeg","image/webp"].includes(type))
     throw Error("INVALID_IMAGE_RESPONSE");
    blob=await response.blob();
    if(blob.size<100||blob.size>5*1024*1024)throw Error("INVALID_IMAGE_RESPONSE");
   }
   const url=URL.createObjectURL(blob);urls.current.push(url);
   const image=new Image();
   await new Promise<void>((resolve,reject)=>{
    image.onload=()=>resolve();image.onerror=()=>reject(Error("INVALID_IMAGE_RESPONSE"));
    image.src=url;
   });
   images.current.set(clip.id,image);setImageTick(t=>t+1);
   update(clip.id,{imageUrl:url,imageCredit:local?"لوحة رقمية مُنشأة محليًا داخل AGENT":"صورة مولدة بطلب المستخدم",
    imageLicense:local&&reference?"AGENT_LOCAL_ART_WITH_CAST":local?"AGENT_LOCAL_ART":"AI_GENERATED_REVIEW_RIGHTS",
    imageSource:undefined});
   setCreatedImageNames(old=>({...old,[clip.id]:"agent-scene-"+clip.id+".png"}));
   setImageEngineNotice(local?"تم إنشاء صورة مشهد أصلية محليًا وإضافتها إلى الفيديو.":
    "تم إنشاء الصورة وإضافتها للمشهد. راجع الوجه والحقوق والتكلفة في حساب مزودك.");
   return true;
  }catch(e){
   const code=e instanceof Error?e.message:"IMAGE_GENERATION_FAILED";
   setError(code==="AI_QUOTA_EXCEEDED"?"حصة توليد الصور لدى المزوّد انتهت. لم يتم تكرار الطلب.":
    code==="INVALID_ORIGIN"?"طلب الصورة رُفض لأسباب أمنية. افتح الاستوديو من رابط Preview المباشر.":
    code==="AI_CREDENTIALS_REJECTED"?"المزوّد رفض مفتاحك. تحقق منه.": 
    code==="IMAGE_RESPONSE_TOO_LARGE"?"ملف الصورة أكبر من الحد المسموح لخادم Preview.":
    "تعذّر إنشاء صورة المشهد: "+code+". لم تُفعّل أي محاولة تلقائية إضافية.");
   return false;
  }finally{
   setImageCostConsent(false);setImageEngineBusy(null);
  }
 };
 const createAllLocalImages=async()=>{
  if(playing||imagesBusy||imageEngineBusy!==null)return;
  setError("");setImagesBusy(true);
  let count=0;const made:Record<number,string>={};
  const updated=[...scenes];
  try{
   for(let i=0;i<scenes.length;i++){
    const clip=scenes[i];setImageNotice("تجهيز الصور مجانًا: "+(i+1)+" / "+scenes.length);
    try{
     const reference=photos.current.get(casting[clip.id]||"");
     const blob=await renderSceneArtwork({sceneId:clip.id,title:clip.title,
      subtitle:(imageDescriptions[clip.id]||"").trim()||clip.subtitle,
      style:imageStyle,aspect:ratio,seed:imageVariation.current++},reference);
     const url=URL.createObjectURL(blob);urls.current.push(url);
     const image=new Image();
     await new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve();image.onerror=()=>reject(Error("IMAGE_LOAD_FAILED"));image.src=url;
     });
     images.current.set(clip.id,image);
     updated[i]={...clip,imageUrl:url,imageCredit:"رسوم أصلية محلية داخل AGENT",
      imageLicense:reference?"AGENT_LOCAL_ART_WITH_CAST":"AGENT_LOCAL_ART",imageSource:undefined};
     made[clip.id]="agent-scene-"+clip.id+".png";count++;
     setScenes([...updated]);setImageTick(v=>v+1);
    }catch{setError("تعذر إنشاء صورة أحد المشاهد، أعد المحاولة لهذا المشهد فقط.");}
   }
   setCreatedImageNames(made);
   setImageEngineNotice("تم إنشاء "+count+" من "+scenes.length+" صورة مجانًا وحفظها داخل المشاهد.");
  }finally{setImagesBusy(false);}
 };
 const downloadCreatedImage=(clip:Scene)=>{
  const url=clip.imageUrl;
  if(!url||!url.startsWith("blob:")||!createdImageNames[clip.id])return;
  const a=document.createElement("a");a.href=url;
  a.download=createdImageNames[clip.id];a.click();
 };
 const update=(id:number,patch:Partial<Scene>)=>{
  if(playing)return;
  setScenes(old=>old.map(c=>c.id===id?{...c,...patch}:c));
  setDownloadUrl(null);
 };
 const onImage=(id:number,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){
   setError("اختار صورة PNG أو JPEG أو WebP لا تتجاوز 10 ميجابايت.");return;
  }
  const url=URL.createObjectURL(file);urls.current.push(url);
  const image=new Image();
  image.onload=()=>setImageTick(x=>x+1);
  image.onerror=()=>setError("تعذر فتح هذه الصورة داخل المتصفح.");
  image.src=url;images.current.set(id,image);
  update(id,{imageUrl:url,imageCredit:undefined,imageLicense:undefined,imageSource:undefined});setError("");
 };
 const onShotVideo=(id:number,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!["video/mp4","video/webm"].includes(file.type)||file.size>120*1024*1024){
   setError("لقطة الحركة يجب أن تكون MP4 أو WebM وأقل من 120 ميجابايت.");return;
  }
  shotVideos.current.get(id)?.pause();
  const url=URL.createObjectURL(file);urls.current.push(url);
  const video=document.createElement("video");
  video.src=url;video.muted=true;video.loop=true;video.playsInline=true;video.preload="auto";
  video.onloadeddata=()=>setImageTick(t=>t+1);
  video.onerror=()=>setError("اللقطة غير قابلة للتشغيل في متصفحك، جرّب ترميز H.264/VP9.");
  video.load();shotVideos.current.set(id,video);
  setShotVideoNames(old=>({...old,[id]:file.name.slice(0,100)}));
  setDownloadUrl(null);setError("");
  event.target.value="";
 };
 const onSceneVoice=(id:number,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith("audio/")||file.size>25*1024*1024){
   setError("حوار المشهد يجب أن يكون صوتًا بصيغة مدعومة وأقل من 25 ميجابايت.");return;
  }
  const url=URL.createObjectURL(file);urls.current.push(url);
  sceneVoices.current.set(id,{url,name:file.name.slice(0,100)});
  setSceneVoiceNames(old=>({...old,[id]:file.name.slice(0,100)}));
  setDownloadUrl(null);setError("");event.target.value="";
 };
 const syncShotVideos=(second:number,active:boolean)=>{
  const cue=elapsedSceneAt(scenes,second);
  shotVideos.current.forEach((video,id)=>{
   if(!cue||id!==cue.sceneId){if(!video.paused)video.pause();return;}
   if(!Number.isFinite(video.duration)||video.duration<=0)return;
   const target=Math.max(0,cue.offset%video.duration);
   if(Math.abs(video.currentTime-target)>.45)try{video.currentTime=target;}catch{}
   if(active&&video.paused&&target<video.duration-.08)
    void video.play().catch(()=>{});
   if(!active&&!video.paused)video.pause();
  });
 };
 const onAudio=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith("audio/")||file.size>25*1024*1024){
   setError("اختار ملفًا صوتيًا حجمه لا يزيد عن 25 ميجابايت.");return;
  }
  const url=URL.createObjectURL(file);urls.current.push(url);
  setAudioUrl(url);setAudioName(file.name.slice(0,100));setDownloadUrl(null);setError("");
 };
 const addScene=()=>{
  if(playing||scenes.length>=MAX_SCENES)return;
  const id=nextId.current++;
  setScenes(old=>old.length>=MAX_SCENES?old:
   [...old,{id,title:"مشهد جديد",subtitle:"اكتب النص هنا",
    speaker:"تعليق أو وصف",duration:6,color:"#7345a6",transition:"fade",imageQuery:"Egypt street"}]);
  setSelectedSceneId(id);setStep("editor");setDownloadUrl(null);
 };

 type ImageCandidate={title:string;imageUrl:string;sourceUrl:string;license:string;author:string;credit:string};
 const loadExternalImage=(id:number,url:string):Promise<boolean>=>new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>{images.current.set(id,image);setImageTick(t=>t+1);resolve(true);};
  image.onerror=()=>resolve(false);
  image.src=safeCommonsUrl(url)?
   "/api/video/image?src="+encodeURIComponent(url):url;
 });
 async function findImages(query:string):Promise<ImageCandidate[]>{
  const lookup=async(text:string)=>{
   const response=await fetch("/api/video/images?q="+encodeURIComponent(text),{cache:"no-store"});
   if(!response.ok)return [] as ImageCandidate[];
   const result=await response.json() as {images?:ImageCandidate[]};
   return (result.images||[]).filter(x=>safeCommonsUrl(x.imageUrl));
  };
  let items=await lookup(query);
  // Some searches have only unsupported formats or licenses. Keep an honest
  // Commons-licensed stock-image fallback, never claim a generated actor/photo.
  if(!items.length&&query!=="Cairo Egypt street")
   items=await lookup("Cairo Egypt street");
  return items;
 }
 async function generateFromStory(){
  if(playing||imagesBusy)return;
  setError("");setImageNotice("");
  let planned:Scene[];
  try{planned=storyboardFromScript(script,requestedSeconds,requestedCount);}
  catch{setError("اكتب قصة من 12 إلى 9000 حرف، وحدد عدد المشاهد والمدة.");return;}
  setScenes(planned);nextId.current=planned.length+1;
  setCreatedImageNames({});setImageDescriptions({});
  setSelectedSceneId(planned[0]?.id||1);previewSecond.current=0;
  shotVideos.current.forEach(v=>v.pause());shotVideos.current.clear();setShotVideoNames({});
  sceneVoices.current.clear();setSceneVoiceNames({});
  setCasting(getCastForScenes(planned,cast,cast[0]?.id));
  images.current.clear();setProgress(0);
  setDownloadUrl(null);setImagesBusy(true);
  let created=0;
  const updated=[...planned],made:Record<number,string>={};
  const assigned=getCastForScenes(planned,cast,cast[0]?.id);
  try{
   // The primary "story to storyboard" flow runs entirely in the browser.
   for(let i=0;i<planned.length;i++){
    const clip=planned[i];setImageNotice("إنشاء صور المشاهد مجانًا: "+(i+1)+" / "+planned.length);
    try{
     const reference=photos.current.get(assigned[clip.id]||"");
     const blob=await renderSceneArtwork({sceneId:clip.id,title:clip.title,subtitle:clip.subtitle,
      style:imageStyle,aspect:ratio,seed:imageVariation.current++},reference);
     const url=URL.createObjectURL(blob);urls.current.push(url);
     const img=new Image();
     await new Promise<void>((resolve,reject)=>{
      img.onload=()=>resolve();img.onerror=()=>reject(Error("INVALID_STORY_IMAGE"));img.src=url;
     });
     images.current.set(clip.id,img);created++;
     made[clip.id]="agent-scene-"+clip.id+".png";
     updated[i]={...clip,imageUrl:url,imageCredit:"رسوم أصلية محلية داخل AGENT",
      imageLicense:reference?"AGENT_LOCAL_ART_WITH_CAST":"AGENT_LOCAL_ART",
      imageSource:undefined};
     setScenes([...updated]);setImageTick(v=>v+1);
    }catch{
     // A single failed canvas render must not lose the story or other scenes.
    }
   }
   setCreatedImageNames(made);
   setImageNotice("تم تجهيز "+planned.length+" مشهدًا وإنشاء "+created+" صورة محلية مجانًا. اختر مشهدًا للتعديل.");
   setStep("design");
  }finally{setImagesBusy(false);}

 }
 async function replaceImage(clip:Scene){
  if(imagesBusy||playing)return;
  setImagesBusy(true);setError("");
  try{
   const query=clip.imageQuery||guessImageQuery(clip.subtitle);
   const options=await findImages(query);
   const taken=new Set(scenes.filter(s=>s.id!==clip.id).map(s=>s.imageUrl||""));
   const asset=options.find(x=>!taken.has(x.imageUrl))||options[0];
   if(!asset||!await loadExternalImage(clip.id,asset.imageUrl)){
    setError("لم تُعثر صورة مناسبة للبحث الحالي؛ عدّل كلمات البحث أو ارفع صورة.");
   }else{
    update(clip.id,{imageUrl:asset.imageUrl,
     imageCredit:asset.author+(asset.credit?" · "+asset.credit:""),
     imageLicense:asset.license,imageSource:asset.sourceUrl});
   }
  }catch{setError("خدمة البحث عن الصور غير متاحة الآن؛ ارفع صورة من جهازك.");}
  finally{setImagesBusy(false);}
 }
 const downloadText=(value:string,fileName:string,type="text/plain;charset=utf-8")=>{
  const url=URL.createObjectURL(new Blob([value],{type}));
  const element=document.createElement("a");element.href=url;element.download=fileName;
  element.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 };
 const saveProject=()=>{
  try{downloadText(exportVideoSession(name,ratio,scenes,cast,casting,productionMode,episode),"agent-video-project.json",
    "application/json;charset=utf-8");}
  catch{setError("تعذر حفظ مسودة المشروع.");}
 };
 const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>130000){setError("ملف المشروع كبير أو غير صالح.");return;}
  try{
   const session=importVideoSession(await file.text());
   const draft=session.draft;
   if(running.current)stop();
   setScenes(draft.scenes);nextId.current=Math.max(...draft.scenes.map(s=>s.id))+1;setName(draft.name);
   setSelectedSceneId(draft.scenes[0].id);setStep("editor");previewSecond.current=0;
   setCreatedImageNames({});setImageDescriptions({});
   shotVideos.current.forEach(v=>v.pause());shotVideos.current.clear();setShotVideoNames({});
   sceneVoices.current.clear();setSceneVoiceNames({});
   if(session.cast){
    setCast(session.cast);nextCastId.current=session.cast.length+1;photos.current.clear();
    setImageTick(t=>t+1);
   }
   setCasting(session.casting||getCastForScenes(draft.scenes,cast,cast[0]?.id));
   if(session.mode)setProductionMode(session.mode);
   if(session.episode)setEpisode(session.episode);
   setRatio(draft.aspect==="1:1"?"9:16":draft.aspect);
   setProgress(0);setDownloadUrl(null);images.current.clear();
   for(const scene of draft.scenes){
    if(scene.imageUrl)void loadExternalImage(scene.id,scene.imageUrl);
   }
   setImageNotice("تم استعادة الشخصيات وروابطها بالمشاهد. أعد إنشاء الصور المحلية ورفع صور الشخصيات ولقطات الحركة والتسجيلات الصوتية.");
   setError("");
  }catch{setError("ملف المشروع غير صالح أو بصيغة غير مدعومة.");}
  event.target.value="";
 };
 const recordVoice=async(sceneId:number|null=null)=>{
  if(micSession.current){
   if(micSession.current.recorder.state!=="inactive")micSession.current.recorder.stop();
   return;
  }
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){
   setError("المتصفح لا يدعم تسجيل التعليق الصوتي.");return;
  }
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const kind=["audio/webm;codecs=opus","audio/webm","audio/mp4"]
    .find(m=>MediaRecorder.isTypeSupported(m))||"";
   const recorder=new MediaRecorder(stream,kind?{mimeType:kind}:{});
   const chunks:Blob[]=[];
   micSession.current={recorder,stream,sceneId};
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());
    if(chunks.length){
     const blob=new Blob(chunks,{type:kind||chunks[0].type||"audio/webm"});
     const url=URL.createObjectURL(blob);urls.current.push(url);
     if(sceneId!==null){
      sceneVoices.current.set(sceneId,{url,name:"حوار مسجّل: المشهد "+sceneId});
      setSceneVoiceNames(old=>({...old,[sceneId]:"حوار مسجّل: المشهد "+sceneId}));
     }else{
      setAudioUrl(url);setAudioName("تعليق صوتي مسجّل داخل AGENT");
     }
     setDownloadUrl(null);
    }
    setRecordingVoice(false);setRecordingSceneId(null);micSession.current=null;
   };
   recorder.start(350);setRecordingVoice(true);setRecordingSceneId(sceneId);setError("");
  }catch{setError("تعذر فتح الميكروفون. اسمح بالتسجيل أو ارفع ملف صوتي.");}
 };

 const stop=()=>{
  const run=running.current;
  if(!run)return;
  run.playing=false;cancelAnimationFrame(run.frame);
  run.audio?.pause();shotVideos.current.forEach(video=>video.pause());
  for(const node of run.voiceNodes)try{node.stop();}catch{}
  if(run.recorder&&run.recorder.state!=="inactive")run.recorder.stop();
  else run.stream?.getTracks().forEach(track=>track.stop());
  if(!run.recorder)void run.audioContext?.close();
  running.current=null;setPlaying(false);setRecording(false);
 };
 const start=async (exportVideo:boolean)=>{
  if(running.current||!canvasRef.current||!scenes.length)return;
  setError("");
  const canvas=canvasRef.current;
  const mime=exportVideo?recorderMime():"";
  if(exportVideo&&(!mime||typeof canvas.captureStream!=="function")){
   setError("المتصفح لا يدعم تصدير الفيديو. جرّب Chrome أو Edge على الكمبيوتر.");return;
  }
  if(exportVideo&&downloadUrl){URL.revokeObjectURL(downloadUrl);setDownloadUrl(null);}
  if(exportVideo&&!musicEnabled&&!audioUrl&&!sceneVoices.current.size){
   setError("فعّل الموسيقى الأصلية أو ارفع تعليقًا صوتيًا لتصدير فيديو بالصوت.");return;
  }
  const run:Run={frame:0,recorder:null,stream:null,audioContext:null,
   audio:null,playing:true,completed:false,voiceNodes:[]};
  try{
   // Input audio is local. Mix it into exported video through a browser-owned
   // Web Audio destination. No files, audio or frames are sent to a server.
   let audioTracks:MediaStreamTrack[]=[];
   let scheduleAudio:((start:number)=>void)|null=null;
   if(audioUrl){
    const audio=new Audio(audioUrl);
    audio.preload="auto";audio.loop=false;
    run.audio=audio;
   }
   if(audioUrl||musicEnabled||sceneVoices.current.size){
    const context=new AudioContext();run.audioContext=context;
    const destination=exportVideo?context.createMediaStreamDestination():null;
    const audioMix=context.createGain();
    audioMix.gain.value=1;
    audioMix.connect(context.destination);
    if(destination)audioMix.connect(destination);
    // Schedule the soundtrack only after local dialogue is decoded.
    if(run.audio){
     const source=context.createMediaElementSource(run.audio);
     const voiceGain=context.createGain();voiceGain.gain.value=.85;
     source.connect(voiceGain);voiceGain.connect(audioMix);
    }
    await context.resume();
    // Decode local dialogue files; sources are queued for precise scene-aligned playback.
    const decoded=(await Promise.all(scenes.map(async clip=>{
     const voice=sceneVoices.current.get(clip.id);
     if(!voice)return [] as {clip:Scene;buffer:AudioBuffer}[];
     const response=await fetch(voice.url);
     const buffer=await context.decodeAudioData(await response.arrayBuffer());
     return [{clip,buffer}];
    }))).flat();
    scheduleAudio=(base:number)=>{
     if(musicEnabled)startAmbientSoundtrack(context,audioMix,total,base);
     let cursor=0;
     for(const clip of scenes){
      const voice=decoded.find(v=>v.clip.id===clip.id);
      if(voice){
       const node=context.createBufferSource();node.buffer=voice.buffer;
       const gain=context.createGain();gain.gain.value=.95;
       node.connect(gain);gain.connect(audioMix);
       node.start(base+cursor,0,Math.min(voice.buffer.duration,clip.duration));
       run.voiceNodes.push(node);
      }
      cursor+=clip.duration;
     }
    };
    if(destination)audioTracks=destination.stream.getAudioTracks();
   }
   if(exportVideo){
    const stream=canvas.captureStream(24);
    run.stream=new MediaStream([...stream.getVideoTracks(),...audioTracks]);
    const recorder=new MediaRecorder(run.stream,{mimeType:mime,videoBitsPerSecond:2_400_000});
    run.recorder=recorder;
    const chunks:Blob[]=[];
    recorder.ondataavailable=event=>{if(event.data.size>0)chunks.push(event.data);};
    recorder.onerror=()=>setError("حدث خطأ أثناء تسجيل الفيديو.");
    recorder.onstop=()=>{
     run.stream?.getTracks().forEach(track=>track.stop());
     void run.audioContext?.close();
     if(!run.completed)return;
     if(!chunks.length){setError("لم يُنتج المتصفح ملف فيديو، جرّب Chrome.");return;}
     const blob=new Blob(chunks,{type:mime});
     if(blob.size<500){setError("الفيديو المُنتج غير مكتمل.");return;}
     const url=URL.createObjectURL(blob);urls.current.push(url);
     setDownloadUrl(url);setDownloadType(mime);
    };
    recorder.start(300);
   }
   running.current=run;
   previewSecond.current=0;setPlaying(true);setRecording(exportVideo);setProgress(0);
   paint(canvas,scenes,images.current,0,photos.current,casting,cast,shotVideos.current);
   syncShotVideos(0,true);
   if(run.audio){try{await run.audio.play();}catch{
    setError("المتصفح منع تشغيل الصوت. اضغط السماح بالصوت، وأعد المحاولة لو لزم.");
   }}
   // Start the audio clock only once MediaRecorder is recording and audio is ready.
   // A short matching preroll prevents clipping the first Arabic syllable.
   const started=performance.now()+150;
   if(scheduleAudio&&run.audioContext) scheduleAudio(run.audioContext.currentTime+.15);
   const frame=(now:number)=>{
    if(!run.playing)return;
    const seconds=Math.min(total,Math.max(0,(now-started)/1000));
    syncShotVideos(seconds,true);
    paint(canvas,scenes,images.current,seconds,photos.current,casting,cast,shotVideos.current);
    previewSecond.current=seconds;setProgress(seconds);
    if(seconds>=total){run.completed=true;stop();return;}
    run.frame=requestAnimationFrame(frame);
   };
   run.frame=requestAnimationFrame(frame);
  }catch{
   run.audio?.pause();shotVideos.current.forEach(video=>video.pause());
   for(const node of run.voiceNodes)try{node.stop();}catch{}
   if(run.recorder&&run.recorder.state!=="inactive")run.recorder.stop();
   run.stream?.getTracks().forEach(t=>t.stop());
   void run.audioContext?.close();
   running.current=null;setPlaying(false);setRecording(false);
   setError("تعذّر بدء تصدير الفيديو؛ تأكد من دعم المتصفح وملف الصوت.");
  }
 };
 const productionPlan=()=>createShotPlan(scenes,cast,casting,productionMode,episode,ratio);
 const downloadShotPlan=()=>downloadText(JSON.stringify(productionPlan(),null,2),
  "agent-video-shot-plan.json","application/json;charset=utf-8");
 const downloadCueSheet=()=>downloadText(JSON.stringify(audioCueSheet(productionPlan()),null,2),
  "agent-arabic-dialogue-cues.json","application/json;charset=utf-8");
 const downloadScript=()=>downloadText(videoScriptDocument(name,scenes),
  "agent-video-script.txt");
 const downloadSubtitles=()=>downloadText(videoSrt(scenes),"agent-video-captions.srt",
  "application/x-subrip;charset=utf-8");
 const downloadCredits=()=>downloadText(scenes.map((clip,i)=>
  "المشهد "+(i+1)+": "+(clip.imageSource||"خلفية أصلية / صورة محلية")+
  "\nالترخيص: "+(clip.imageLicense||"—")+
  "\nنسب الصورة: "+(clip.imageCredit||"—")).join("\n\n"),
  "agent-video-image-credits.txt");

 return <section className={s.studio} aria-label="استوديو صناعة الفيديو">
  <header className={s.topbar}>
   <div className={s.brand}>
    <div className={s.brandMark}><Film size={22}/></div>
    <div>
     <span className={s.eyebrow}>AGENT / CREATOR STUDIO</span>
     <h1>صناعة فيديو من السيناريو إلى المشاهد</h1>
    </div>
   </div>
   <div className={s.topActions}>
    <span className={s.freePill}>مجاني · يعمل في المتصفح</span>
    <button type="button" className={s.secondary} disabled={playing||imagesBusy}
     onClick={saveProject}><Save size={15}/> حفظ المشروع</button>
    <button type="button" className={s.iconButton} disabled={playing||imagesBusy}
     onClick={()=>fileImportRef.current?.click()} title="استعادة مشروع">
     <RefreshCw size={17}/><span className={s.mobileHide}>استعادة</span>
    </button>
    <input ref={fileImportRef} type="file" hidden accept=".json,application/json"
     onChange={e=>void importProject(e)}/>
   </div>
  </header>
  <div className={s.projectStrip}>
   <div className={s.projectName}><span className={s.muted}>المشروع</span>
    <strong>{name||"بدون عنوان"}</strong>
   </div>
   <div className={s.projectMetrics}>
    <span><Film size={14}/>{scenes.length} مشاهد</span>
    <span><Play size={14}/>{fmt(total)} دقيقة</span>
    <span>{ratio==="9:16"?"عمودي 9:16":"أفقي 16:9"}</span>
   </div>
  </div>
  <nav className={s.steps} aria-label="مراحل صناعة الفيديو">
   {([
    {id:"story",title:"القصة",desc:"ابدأ بالسيناريو"},
    {id:"design",title:"التصميم",desc:"الصور والشخصيات"},
    {id:"editor",title:"المونتاج",desc:"عدّل كل مشهد"},
    {id:"export",title:"التصدير",desc:"احفظ الفيديو"}
   ] as const).map((item,i)=>
    <button type="button" key={item.id} data-step={item.id}
     aria-current={step===item.id?"step":undefined}
     className={s.step+(step===item.id?" "+s.stepActive:"")}
     onClick={()=>setStep(item.id)}>
     <span className={s.stepNumber}>{i+1}</span>
     <span><strong>{item.title}</strong><small>{item.desc}</small></span>
    </button>)}
  </nav>

  {error&&<div className={s.error} role="alert">{error}</div>}
  <div className={s.editorShell}>
   <main className={s.workArea}>
    {step==="story"&&<section className={s.panel} aria-label="كتابة القصة">
     <div className={s.panelHead}>
      <span className={s.sectionKicker}>01 / CREATE</span>
      <h2>ابدأ بقصة. وسنجهّز المشاهد.</h2>
      <p>اكتب فكرتك ثم اختر المدة وعدد المشاهد. سننشئ لوحة بصرية مجانية لكل مشهد تلقائيًا، ويمكن تعديل كل شيء بعد ذلك.</p>
     </div>
     <h3 className={s.subheading}>نوع الفيديو</h3>
     <div className={s.modeGrid}>
      {(Object.keys(AGENT_VIDEO_MODES) as AgentVideoMode[]).map(mode=>
       <button key={mode} type="button"
        className={productionMode===mode?s.modeActive:s.modeButton}
        disabled={playing||imagesBusy} onClick={()=>chooseMode(mode)}>
        <strong>{AGENT_VIDEO_MODES[mode].name}</strong>
        <span>{mode==="episodes"?"مشاهد لحلقة كاملة":
         mode==="short-series"?"سرد متصل بعدة مشاهد":"قصير وسريع للسوشيال"}</span>
       </button>)}
     </div>
     <div className={s.formGrid}>
      <label className={s.field+" "+s.wide}>اسم المشروع
       <input value={name} maxLength={100} disabled={playing||imagesBusy}
        onChange={e=>setName(e.target.value)} placeholder="اسم الفيديو"/>
      </label>
      {productionMode==="episodes"&&<label className={s.field}>رقم الحلقة
       <input type="number" value={episode} min={1} max={999} disabled={playing}
        onChange={e=>setEpisode(Math.max(1,Math.min(999,Number(e.target.value)||1)))}/>
      </label>}
      <label className={s.field}>عدد المشاهد
       <input type="number" min={currentMode.minCount} max={currentMode.maxCount}
        value={requestedCount} disabled={playing||imagesBusy}
        onChange={e=>setRequestedCount(Math.max(currentMode.minCount,
         Math.min(currentMode.maxCount,Number(e.target.value)||1)))}/>
      </label>
      <label className={s.field}>المدة المستهدفة (ثانية)
       <input type="number" min={12} max={720} step={15} value={requestedSeconds}
        disabled={playing||imagesBusy} onChange={e=>setRequestedSeconds(
         Math.max(12,Math.min(720,Number(e.target.value)||180)))}/>
      </label>
      <label className={s.field+" "+s.wide}>القصة أو السيناريو
       <textarea rows={8} maxLength={9000} value={script} disabled={playing||imagesBusy}
        onChange={e=>setScript(e.target.value)}
        placeholder="في أحد شوارع القاهرة، تبدأ حكاية..."/>
       <span className={s.small}>{script.length} / 9000 حرف</span>
      </label>
     </div>
     <div className={s.actionBar}>
      <button type="button" className={s.button} disabled={playing||imagesBusy}
       onClick={()=>void generateFromStory()}><ImagePlus size={17}/>
       {imagesBusy?"نجهّز المشاهد والصور...":"إنشاء المشاهد والصور مجانًا"}</button>
      <span className={s.small}>لا تحتاج مفتاح API · ويمكنك التعديل بعدها</span>
     </div>
     {imageNotice&&<div className={s.success} role="status">{imageNotice}</div>}
     <div className={s.hint}><span>الخطوة التالية</span>
      <button type="button" className={s.textButton} onClick={()=>setStep("design")}>
       انتقل للتصميم <span aria-hidden="true">←</span>
      </button>
     </div>
    </section>}

    {step==="design"&&<section className={s.panel} aria-label="تصميم المشاهد">
     <div className={s.panelHead}>
      <span className={s.sectionKicker}>02 / VISUALS</span>
      <h2>اختر شكل الفيديو</h2>
      <p>لوحات بصرية مجانية، تتولد محليًا من وصف كل مشهد. صور شخصياتك لا تغادر المتصفح.</p>
     </div>
     <h3 className={s.subheading}>أسلوب الصور</h3>
     <div className={s.styleGrid}>
      {([{id:"cinematic",label:"سينمائي",description:"ألوان وإضاءة درامية",tone:"cine"},
         {id:"comic",label:"رسوم قصصية",description:"مظهر رسومي نابض",tone:"comic"},
         {id:"noir",label:"ليلي",description:"ظلال عميقة وهدوء",tone:"noir"}] as const).map(style=>
       <button type="button" key={style.id}
        className={s.styleTile+(imageStyle===style.id?" "+s.styleSelected:"")}
        aria-pressed={imageStyle===style.id}
        disabled={playing||imagesBusy}
        onClick={()=>{setImageStyle(style.id);setImageEngine("local");}}>
        <span className={s.styleSwatch+" "+s[style.tone]} aria-hidden="true"></span>
        <strong>{style.label}</strong><small>{style.description}</small>
       </button>)}
     </div>
     <div className={s.actionBar}>
      <button type="button" className={s.button}
       disabled={playing||imagesBusy||imageEngineBusy!==null}
       onClick={()=>void createAllLocalImages()}>
       <ImagePlus size={17}/>{imagesBusy?"إنشاء الصور...":"إنشاء صور جميع المشاهد مجانًا"}
      </button>
      <span className={s.small}>يتم إدراج الصور في المونتاج مباشرة</span>
     </div>
     {(imageEngineNotice||imageNotice)&&<div className={s.success} role="status">
      {imageEngineNotice||imageNotice}</div>}

     <details className={s.details}>
      <summary><span>الشخصيات وصورها المرجعية</span><span className={s.summaryHint}>{cast.length} شخصيات · اختياري</span></summary>
      <div className={s.detailsBody}>
       <p className={s.small}>ارفع صورة لكل شخصية لتظهر الصورة نفسها في جميع المشاهد المرتبطة بها. لن يتم إرسالها لخادم خارجي.</p>
       {cast.map(character=><div className={s.castCard} key={character.id}>
        <div className={s.clipTop}><strong>{character.name||"شخصية"}</strong>
         <button type="button" className={s.danger} disabled={playing||cast.length===1}
          onClick={()=>{setCast(old=>old.filter(c=>c.id!==character.id));
           photos.current.delete(character.id);
           setCasting(old=>Object.fromEntries(Object.entries(old).map(([k,v])=>
            [k,v===character.id?"":v])));}}>
          <Trash2 size={14}/> حذف</button>
        </div>
        <div className={s.formGrid}>
         <label className={s.field}>الاسم<input value={character.name} maxLength={80}
          disabled={playing} onChange={e=>editCast(character.id,{name:e.target.value})}/></label>
         <label className={s.field}>نوع الصوت<input value={character.voiceLabel} maxLength={90}
          disabled={playing} onChange={e=>editCast(character.id,{voiceLabel:e.target.value})}/></label>
         <label className={s.field+" "+s.wide}>ملامح الشخصية<textarea value={character.appearance}
          maxLength={300} disabled={playing}
          onChange={e=>editCast(character.id,{appearance:e.target.value})}/></label>
         <label className={s.field+" "+s.wide}>الملابس<input value={character.wardrobe}
          maxLength={200} disabled={playing}
          onChange={e=>editCast(character.id,{wardrobe:e.target.value})}/></label>
         <label className={s.field+" "+s.wide}>الصورة المرجعية
          <input type="file" accept="image/png,image/jpeg,image/webp"
           disabled={playing} onChange={e=>uploadCastPhoto(character.id,e)}/>
          <span className={s.small}>{photos.current.has(character.id)?"صورة مثبتة":"لم تُرفع صورة بعد"}</span>
         </label>
        </div>
       </div>)}
       <div className={s.buttonRow}>
        <button type="button" className={s.secondary} disabled={playing||cast.length>=15}
         onClick={addCastMember}><Plus size={14}/> إضافة شخصية</button>
        <button type="button" className={s.secondary} onClick={()=>downloadText(
         castBibleAsJson(cast),"agent-character-bible.json","application/json")}>
         <Save size={14}/> حفظ الشخصيات</button>
        <button type="button" className={s.secondary}
         onClick={()=>castFileRef.current?.click()}><RefreshCw size={14}/> استعادة الشخصيات</button>
        <input ref={castFileRef} type="file" hidden accept=".json,application/json"
         onChange={e=>void importCast(e)}/>
       </div>
       {castNotice&&<div className={s.success} role="status">{castNotice}</div>}
      </div>
     </details>
     <details className={s.details}>
      <summary><span>خيارات إنشاء الصور الخارجية (اختيارية وقد تكون مدفوعة)</span><span className={s.summaryHint}>ليست مطلوبة</span></summary>
      <div className={s.detailsBody}>
       <label className={s.field}>طريقة الإنشاء
        <select value={imageEngine} disabled={playing||imageEngineBusy!==null}
         onChange={e=>{setImageEngine(e.target.value as "local"|"ai");
          setImageCostConsent(false);setError("");}}>
         <option value="local">رسم محلي مجاني (الافتراضي)</option>
         <option value="ai">إنشاء صورة AI عبر مفتاحك الخاص · قد يكلّف</option>
        </select>
       </label>
       {imageEngine==="ai"&&<>
        <label className={s.field}>مزود الصور
         <select value={imageAIProvider} disabled={playing||imageEngineBusy!==null}
          onChange={e=>{setImageAIProvider(e.target.value as "openai"|"gemini");setImageCostConsent(false);}}>
          <option value="openai">OpenAI · gpt-image-1</option>
          <option value="gemini">Gemini · gemini-2.5-flash-image</option>
         </select>
        </label>
        <label className={s.field}>مفتاح API الخاص بك
         <input type="password" autoComplete="off" value={imageApiKey}
          disabled={playing||imageEngineBusy!==null}
          placeholder="أدخل المفتاح لمرة واحدة في هذه الجلسة"
          onChange={e=>{setImageApiKey(e.target.value);setImageCostConsent(false);}}/>
        </label>
        <label className={s.field}>
         <span className={s.consentLine}><input type="checkbox"
          checked={imageCostConsent} disabled={playing||imageEngineBusy!==null}
          onChange={e=>setImageCostConsent(e.target.checked)}/>
          أوافق على إرسال وصف المشهد للمزوّد وعلى تكلفة توليد صورة واحدة، وأعرف أن السعر يختلف حسب حسابي.</span>
        </label>
        <p className={s.small}>الوجه المرجعي لا يُرسل. لن تُفعّل أي خدمة مدفوعة تلقائيًا، ولا توجد إعادة محاولات آلية.</p>
       </>}
      </div>
     </details>
     <div className={s.hint}><span>هل الصور جاهزة؟</span>
      <button type="button" className={s.textButton} onClick={()=>setStep("editor")}>
       افتح المونتاج <span aria-hidden="true">←</span>
      </button>
     </div>
    </section>}

    {step==="editor"&&<section className={s.panel} aria-label="مونتاج المشاهد">
     <div className={s.panelHead}>
      <span className={s.sectionKicker}>03 / EDITOR</span>
      <h2>المشهد {scenes.findIndex(c=>c.id===selectedScene.id)+1} من {scenes.length}</h2>
      <p>اختر مشهدًا من الشريط السفلي لتعديل النص أو الصورة أو الصوت. تظهر التغييرات في المعاينة.</p>
     </div>
     <div className={s.clip}>
      <div className={s.clipTop}><strong>{selectedScene.title}</strong>
       <div className={s.buttonRow}>
        <button type="button" className={s.secondary}
         disabled={playing||scenes.length>=MAX_SCENES}
         onClick={addScene}>
         <Plus size={14}/> مشهد جديد</button>
        <button type="button" className={s.danger} aria-label={"حذف المشهد "+(scenes.findIndex(c=>c.id===selectedScene.id)+1)}
         disabled={playing||scenes.length<=1}
         onClick={()=>{const id=selectedScene.id;images.current.delete(id);
          shotVideos.current.get(id)?.pause();shotVideos.current.delete(id);
          sceneVoices.current.delete(id);
          setShotVideoNames(old=>{const n={...old};delete n[id];return n;});
          setSceneVoiceNames(old=>{const n={...old};delete n[id];return n;});
          setSelectedSceneId(scenes.find(c=>c.id!==id)?.id||1);
          setScenes(old=>old.filter(c=>c.id!==id));setDownloadUrl(null);}}>
         <Trash2 size={14}/> حذف</button>
       </div>
      </div>
      <div className={s.formGrid}>
       <label className={s.field}>عنوان المشهد
        <input value={selectedScene.title} maxLength={80} disabled={playing}
         onChange={e=>update(selectedScene.id,{title:e.target.value})}/></label>
       <label className={s.field}>المدة (3–25 ثانية)
        <input type="number" min={3} max={25} value={selectedScene.duration} disabled={playing}
         onChange={e=>update(selectedScene.id,{duration:boundedDuration(Number(e.target.value))})}/>
       </label>
       <label className={s.field+" "+s.wide}>النص الظاهر في الفيديو
        <textarea rows={3} maxLength={500} value={selectedScene.subtitle} disabled={playing}
         onChange={e=>update(selectedScene.id,{subtitle:e.target.value})}/>
       </label>
       <label className={s.field}>الشخصية المرتبطة
        <select value={casting[selectedScene.id]||""} disabled={playing}
         onChange={e=>{setCasting(old=>({...old,[selectedScene.id]:e.target.value}));setDownloadUrl(null);}}>
         <option value="">بدون شخصية</option>
         {cast.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
       </label>
       <label className={s.field}>اسم المتحدث
        <input value={selectedScene.speaker} maxLength={70} disabled={playing}
         onChange={e=>update(selectedScene.id,{speaker:e.target.value})}/>
       </label>
       <label className={s.field+" "+s.wide}>وصف الصورة
        <textarea rows={2} value={imageDescriptions[selectedScene.id]||""}
         maxLength={400} disabled={playing||imageEngineBusy!==null}
         onChange={e=>setImageDescriptions(old=>({...old,[selectedScene.id]:e.target.value}))}
         placeholder="مثال: محطة قطار ليلية، أضواء دافئة..."/>
       </label>
      </div>
      <div className={s.assetStrip}>
       <div className={s.assetGroup}>
        <span className={s.muted}>الصورة</span>
        <div className={s.buttonRow}>
         <button type="button" className={s.button}
          disabled={playing||imagesBusy||imageEngineBusy!==null}
          onClick={()=>void createSceneImage(selectedScene)}>
          <ImagePlus size={15}/>
          {imageEngineBusy===selectedScene.id?"جارٍ إنشاء الصورة...":
           "إنشاء صورة للمشهد ("+(imageEngine==="local"?"مجاني":"AI")+")"}
         </button>
         {createdImageNames[selectedScene.id]&&<button type="button" className={s.secondary}
          onClick={()=>downloadCreatedImage(selectedScene)}><Download size={14}/> تحميل PNG</button>}
        </div>
        <label className={s.fileLabel}>أو ارفع صورة
         <input type="file" accept="image/png,image/jpeg,image/webp"
          disabled={playing} onChange={e=>onImage(selectedScene.id,e)}/>
        </label>
       </div>
       <div className={s.assetGroup}>
        <span className={s.muted}>لقطة حركة</span>
        <label className={s.fileLabel}>رفع MP4 / WebM
         <input type="file" accept="video/mp4,video/webm" disabled={playing}
          onChange={e=>onShotVideo(selectedScene.id,e)}/>
        </label>
        <span className={s.small}>{shotVideoNames[selectedScene.id]||"بدون لقطة حركة · ستُستخدم الصورة المتحركة بصريًا"}</span>
       </div>
       <div className={s.assetGroup}>
        <span className={s.muted}>الحوار والصوت</span>
        <div className={s.buttonRow}>
         <button type="button" className={recordingSceneId===selectedScene.id?s.danger:s.secondary}
          disabled={playing||(recordingVoice&&recordingSceneId!==selectedScene.id)}
          onClick={()=>void recordVoice(selectedScene.id)}>
          <Mic size={14}/>{recordingSceneId===selectedScene.id?"إيقاف تسجيل حوار المشهد":"تسجيل حوار المشهد من الميكروفون"}
         </button>
         <button type="button" className={s.secondary} disabled={playing}
          onClick={()=>previewArabicVoice(selectedScene.subtitle)}>
          <Play size={13}/> سماع النص (معاينة فقط)</button>
        </div>
        <label className={s.fileLabel}>أو ارفع ملف صوت
         <input type="file" accept="audio/*" disabled={playing}
          onChange={e=>onSceneVoice(selectedScene.id,e)}/>
        </label>
        <span className={s.small}>{sceneVoiceNames[selectedScene.id]||"لم يُسجل صوت بعد. المعاينة الآلية لا تدخل في التصدير."}</span>
       </div>
      </div>
      <details className={s.details}>
       <summary>خيارات المشهد المتقدمة</summary>
       <div className={s.detailsBody}>
        <div className={s.formGrid}>
         <label className={s.field}>لون خلفية المشهد
          <input type="color" value={selectedScene.color} disabled={playing}
           onChange={e=>update(selectedScene.id,{color:e.target.value})}/>
         </label>
         <label className={s.field}>بحث صور مرخّصة
          <input value={selectedScene.imageQuery||""} maxLength={100}
           disabled={playing||imagesBusy}
           onChange={e=>update(selectedScene.id,{imageQuery:e.target.value})}/>
         </label>
        </div>
        <button type="button" className={s.secondary}
         disabled={playing||imagesBusy} onClick={()=>void replaceImage(selectedScene)}>
         <ImagePlus size={14}/> جلب صورة من Wikimedia</button>
        {selectedScene.imageSource&&<a href={selectedScene.imageSource}
         target="_blank" rel="noopener noreferrer" className={s.sourceLink}>
         مصدر الصورة · {selectedScene.imageLicense||"راجع الترخيص"}</a>}
       </div>
      </details>
     </div>
     <div className={s.hint}><span>انتهيت من التعديل؟</span>
      <button type="button" className={s.textButton} onClick={()=>setStep("export")}>
       الانتقال للتصدير <span aria-hidden="true">←</span>
      </button>
     </div>
    </section>}

    {step==="export"&&<section className={s.panel} aria-label="إعدادات التصدير">
     <div className={s.panelHead}>
      <span className={s.sectionKicker}>04 / EXPORT</span>
      <h2>فيديوك جاهز للتجميع</h2>
      <p>اختر الأبعاد، أضف الموسيقى أو التعليق، ثم اضغط «تصدير الفيديو» في المعاينة. يعمل التصدير في متصفحك دون اشتراك.</p>
     </div>
     <div className={s.exportSummary}>
      <div><strong>{scenes.length}</strong><span>مشاهد</span></div>
      <div><strong>{fmt(total)}</strong><span>المدة</span></div>
      <div><strong>{scenes.filter(c=>shotVideoNames[c.id]).length}</strong><span>مقاطع حركة</span></div>
      <div><strong>{scenes.filter(c=>sceneVoiceNames[c.id]).length}</strong><span>حوارات</span></div>
     </div>
     <h3 className={s.subheading}>أبعاد الفيديو</h3>
     <div className={s.segment} role="group" aria-label="أبعاد الفيديو">
      <button type="button" className={ratio==="9:16"?s.active:""} disabled={playing}
       onClick={()=>setRatio("9:16")}>9:16 · ريلز وشورتس</button>
      <button type="button" className={ratio==="16:9"?s.active:""} disabled={playing}
       onClick={()=>setRatio("16:9")}>16:9 · يوتيوب</button>
     </div>
     <div className={s.audioTools}>
      <label className={s.field}>تعليق صوتي أو موسيقى من جهازك
       <input type="file" accept="audio/*" disabled={playing} onChange={onAudio}/>
       <span className={s.small}>{audioName||"لم تختر ملفًا — يمكنك إضافة تسجيل من الميكروفون"}</span>
      </label>
      <button type="button" className={recordingVoice?s.danger:s.secondary}
       disabled={playing||(recordingVoice&&recordingSceneId!==null)}
       onClick={()=>void recordVoice()}>
       <Mic size={14}/>{recordingVoice&&recordingSceneId===null?"إيقاف تسجيل صوتي":"تسجيل تعليق بصوتك"}
      </button>
      <label className={s.field}><span className={s.consentLine}>
       <input type="checkbox" checked={musicEnabled} disabled={playing}
        onChange={e=>setMusicEnabled(e.target.checked)}/>
       إضافة موسيقى خلفية أصلية مجانية</span></label>
     </div>
     <div className={s.notice}>يستغرق التصدير قرابة مدة الفيديو الفعلية. الفيديوهات المرفوعة لا يُدمج صوتها تلقائيًا، لذا استخدم ملفات الحوار أو التسجيلات المنفصلة. الناتج WebM أو MP4 حسب دعم متصفحك.</div>
     <details className={s.details}>
      <summary>ملفات المشروع والترجمة والإنتاج</summary>
      <div className={s.detailsBody}>
       <div className={s.buttonRow}>
        <button type="button" className={s.secondary} onClick={downloadScript}>
         <FileText size={14}/> السيناريو</button>
        <button type="button" className={s.secondary} onClick={downloadSubtitles}>
         <FileText size={14}/> ترجمة SRT</button>
        <button type="button" className={s.secondary} onClick={downloadCredits}>
         <FileText size={14}/> حقوق الصور</button>
        <button type="button" className={s.secondary} onClick={downloadShotPlan}>
         <FileText size={14}/> خطة صور وحركة JSON</button>
        <button type="button" className={s.secondary} onClick={downloadCueSheet}>
         <FileText size={14}/> توقيت الحوارات JSON</button>
       </div>
      </div>
     </details>
    </section>}
   </main>

   <aside className={s.playerRail} aria-label="معاينة الفيديو والتصدير">
    <div className={s.playerHeader}>
     <span className={s.playerLive}><span className={s.liveDot}/>معاينة الفيديو</span>
     <span className={s.playerMeta}>{ratio} · {fmt(total)}</span>
    </div>
    <div className={s.preview}>
     <div className={s.frame}>
      <canvas ref={canvasRef} width={540} height={960} aria-label="معاينة الفيديو قبل التصدير"/>
     </div>
    </div>
    <div className={s.seekRow}>
     <span className={s.clock}>{fmt(progress)}</span>
     <input className={s.progress} aria-label="تقدم تشغيل الفيديو" type="range"
      min={0} max={Math.max(1,total)} step={.1} value={Math.min(progress,total)}
      disabled={playing} onChange={e=>seekTo(Number(e.target.value))}/>
     <span className={s.clock}>{fmt(total)}</span>
    </div>
    <div className={s.playerActions}>
     <button type="button" className={s.secondary}
      onClick={()=>playing?stop():void start(false)}>
      {playing?<Pause size={16}/>:<Play size={16}/>}
      {playing?"إيقاف":"تشغيل المعاينة"}
     </button>
     <button type="button" className={s.button} disabled={playing}
      onClick={()=>{setStep("export");void start(true);}}>
      <Video size={16}/>{recording?"جارٍ التسجيل...":"تصدير الفيديو"}
     </button>
    </div>
    {downloadUrl&&<div className={s.success}>
     تم إنشاء الفيديو بنجاح. يمكنك تنزيله الآن.
     <a className={s.downloadButton} href={downloadUrl}
      download={"agent-"+(productionMode==="episodes"?"episode-"+episode+"-":"video-")+
       (downloadType.includes("mp4")?"video.mp4":"video.webm")}>
      <Download size={16}/> تحميل الفيديو</a>
    </div>}
    <div className={s.playerFoot}>
     <span>مقاطع حركة فعلية: {scenes.filter(clip=>shotVideoNames[clip.id]).length} / {scenes.length}</span>
     <span>حوارات عربية مضافة: {scenes.filter(clip=>sceneVoiceNames[clip.id]).length} / {scenes.length}</span>
    </div>
   </aside>
  </div>

  <section className={s.timeline} aria-label="شريط مشاهد الفيديو">
   <div className={s.timelineHeader}>
    <div><span className={s.sectionKicker}>STORYBOARD</span><h2>الخط الزمني للمشاهد</h2></div>
    <span className={s.small}>اضغط على أي مشهد لتعديله</span>
   </div>
   <div className={s.timelineTrack}>
    {scenes.map((clip,index)=><button type="button" key={clip.id}
     aria-label={"اختيار المشهد "+(index+1)}
     aria-pressed={selectedScene.id===clip.id}
     disabled={playing}
     className={s.sceneCard+(selectedScene.id===clip.id?" "+s.sceneCardActive:"")}
     onClick={()=>selectScene(clip.id)}>
     <span className={s.sceneThumb} style={{backgroundColor:clip.color}}>
      {clip.imageUrl&&<img src={clip.imageUrl} alt=""/>}
      <span className={s.sceneNumber}>{String(index+1).padStart(2,"0")}</span>
      {shotVideoNames[clip.id]&&<span className={s.motionIndicator}><Video size={13}/></span>}
     </span>
     <span className={s.sceneText}><strong>{clip.title||"مشهد"}</strong>
      <small>{clip.duration} ثوانٍ {sceneVoiceNames[clip.id]?"· صوت":""}</small></span>
    </button>)}
    <button type="button" className={s.addSceneCard}
     disabled={playing||scenes.length>=MAX_SCENES}
     onClick={addScene}>
     <Plus size={22}/> مشهد جديد
    </button>
   </div>
  </section>
  <footer className={s.footer}>توليد الصور المحلي ورسوم المشاهد ومزج الصوت والتصدير يعملون دون اشتراك. هذه النسخة لا تولّد ممثلين فوتوغرافيين متحركين أو مزامنة شفاه تلقائيًا.</footer>
 </section>;
}
