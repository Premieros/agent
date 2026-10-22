"use client";

import {useCallback,useEffect,useRef,useState,type ChangeEvent} from "react";
import {Download,Film,ImagePlus,Music2,Pause,Play,Plus,Trash2,Video,Mic,Save,FileText,RefreshCw} from "lucide-react";
import {storyboardFromScript,serializeVideoDraft,parseVideoDraft,videoSrt,
 videoScriptDocument,guessImageQuery,safeCommonsUrl,MAX_VIDEO_SCENES,
 type VideoScene} from "@/lib/agent-video-storyboard";
import {startAmbientSoundtrack} from "@/lib/agent-video-soundtrack";
import {createShotPlan,audioCueSheet,elapsedSceneAt} from "@/lib/agent-video-pipeline";
import {AGENT_VIDEO_MODES,getCastForScenes,castBibleAsJson,parseCastBible,
 type AgentVideoCharacter,type AgentVideoMode} from "@/lib/agent-video-production";
import s from "./agent-video-studio.module.css";

type Ratio="16:9"|"9:16";
type Scene=VideoScene;
type Run={frame:number;recorder:MediaRecorder|null;stream:MediaStream|null;
 audioContext:AudioContext|null;audio:HTMLAudioElement|null;playing:boolean;completed:boolean;
 voiceNodes:AudioBufferSourceNode[]};
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
 if(!movingFrame&&actorPhoto&&actorPhoto.complete&&actorPhoto.naturalWidth>0){
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
 const [musicEnabled,setMusicEnabled]=useState(true);
 const [recordingVoice,setRecordingVoice]=useState(false);
 const micSession=useRef<{recorder:MediaRecorder;stream:MediaStream}|null>(null);
 const fileImportRef=useRef<HTMLInputElement|null>(null);
 const [ratio,setRatio]=useState<Ratio>("9:16");
 const [audioUrl,setAudioUrl]=useState<string|null>(null);
 const [audioName,setAudioName]=useState("");
 const [progress,setProgress]=useState(0);
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
  draw(0);
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
  video.src=url;video.muted=true;video.playsInline=true;video.preload="auto";
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
   const target=Math.min(Math.max(0,cue.offset),Math.max(0,video.duration-.06));
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
 const addScene=()=>setScenes(old=>old.length>=MAX_SCENES?old:
  [...old,{id:nextId.current++,title:"مشهد جديد",subtitle:"اكتب النص هنا",
   speaker:"تعليق أو وصف",duration:6,color:"#7345a6",transition:"fade",imageQuery:"Egypt street"}]);

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
  setScenes(planned);
  shotVideos.current.forEach(v=>v.pause());shotVideos.current.clear();setShotVideoNames({});
  sceneVoices.current.clear();setSceneVoiceNames({});
  setCasting(getCastForScenes(planned,cast,cast[0]?.id));
  images.current.clear();setProgress(0);
  setDownloadUrl(null);setImagesBusy(true);
  let loaded=0;const used=new Set<string>(),updated=[...planned];
  for(let offset=0;offset<planned.length;offset+=3){
   const current=planned.slice(offset,offset+3);
   setImageNotice("جارٍ البحث عن صور المشاهد "+(offset+1)+" إلى "+
    Math.min(planned.length,offset+3)+" من "+planned.length+"...");
   const results=await Promise.all(current.map(async clip=>{
    try{
     const query=clip.imageQuery||guessImageQuery(clip.subtitle);
     const options=await findImages(query);
     return {clip,options};
    }catch{return {clip,options:[] as ImageCandidate[]};}
   }));
   for(const {clip,options} of results){
    const asset=options.find(image=>!used.has(image.imageUrl))||options[0];
    if(!asset)continue;
    const okay=await loadExternalImage(clip.id,asset.imageUrl);
    if(!okay)continue;
    used.add(asset.imageUrl);loaded++;
    updated[clip.id-1]={...clip,imageUrl:asset.imageUrl,
     imageCredit:asset.author+(asset.credit?" · "+asset.credit:""),
     imageLicense:asset.license,imageSource:asset.sourceUrl};
   }
   setScenes([...updated]);
  }
  setImagesBusy(false);
  setImageNotice("تم تجهيز "+planned.length+" مشهدًا. تم العثور على "+loaded+
   " صورة مرخّصة. يمكنك تغيير أي صورة أو رفع صورك بدلًا منها.");
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
  try{downloadText(serializeVideoDraft(name,ratio,scenes),"agent-video-project.json",
    "application/json;charset=utf-8");}
  catch{setError("تعذر حفظ مسودة المشروع.");}
 };
 const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>110000){setError("ملف المشروع كبير أو غير صالح.");return;}
  try{
   const draft=parseVideoDraft(await file.text());
   if(running.current)stop();
   setScenes(draft.scenes);setName(draft.name);
   shotVideos.current.forEach(v=>v.pause());shotVideos.current.clear();setShotVideoNames({});
   sceneVoices.current.clear();setSceneVoiceNames({});
   setCasting(getCastForScenes(draft.scenes,cast,cast[0]?.id));
   setRatio(draft.aspect==="1:1"?"9:16":draft.aspect);
   setProgress(0);setDownloadUrl(null);images.current.clear();
   for(const scene of draft.scenes){
    if(scene.imageUrl)void loadExternalImage(scene.id,scene.imageUrl);
   }
   setImageNotice("تم استعادة المشروع. الصور المُحمّلة من جهازك تحتاج إعادة رفعها.");
   setError("");
  }catch{setError("ملف المشروع غير صالح أو بصيغة غير مدعومة.");}
  event.target.value="";
 };
 const recordVoice=async()=>{
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
   micSession.current={recorder,stream};
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{
    stream.getTracks().forEach(t=>t.stop());
    if(chunks.length){
     const blob=new Blob(chunks,{type:kind||chunks[0].type||"audio/webm"});
     const url=URL.createObjectURL(blob);urls.current.push(url);
     setAudioUrl(url);setAudioName("تعليق صوتي مسجّل داخل AGENT");
    }
    setRecordingVoice(false);micSession.current=null;
   };
   recorder.start(350);setRecordingVoice(true);setError("");
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
    if(musicEnabled)startAmbientSoundtrack(context,audioMix,total);
    const base=context.currentTime+.08;
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
   setPlaying(true);setRecording(exportVideo);setProgress(0);
   paint(canvas,scenes,images.current,0,photos.current,casting,cast,shotVideos.current);
   syncShotVideos(0,true);
   if(run.audio){try{await run.audio.play();}catch{
    setError("المتصفح منع تشغيل الصوت. اضغط السماح بالصوت، وأعد المحاولة لو لزم.");
   }}
   const started=performance.now();
   const frame=(now:number)=>{
    if(!run.playing)return;
    const seconds=Math.min(total,(now-started)/1000);
    syncShotVideos(seconds,true);
    paint(canvas,scenes,images.current,seconds,photos.current,casting,cast,shotVideos.current);
    setProgress(seconds);
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
  <div className={s.hero}>
   <span className={s.eyebrow}>AGENT VIDEO STUDIO · نسخة تجريبية</span>
   <h1>صناعة فيديو من السيناريو إلى المشاهد</h1>
   <p>مستوحى من استوديو «مش من مستوانا». اكتب مشاهدك وارفع صورًا وصوتًا اختياريًا،
    وشاهدها ثم صدّر فيديو من المتصفح بدون مفتاح API أو رسوم توليد.
    هذه النسخة تحرّك الصور والنصوص ولا تولّد ممثلين أو لقطات فوتوغرافية بالذكاء الاصطناعي.</p>
   <span className={s.status}>كل الملفات تُعالج محليًا داخل المتصفح · لا يُستخدم أي مشروع أو قاعدة بيانات أخرى</span>
  </div>
  <section className={s.panel} style={{marginBottom:16}}>
   <h2>اختر نوع الإنتاج</h2>
   <div className={s.modeGrid}>
    {(Object.keys(AGENT_VIDEO_MODES) as AgentVideoMode[]).map(mode=>
     <button key={mode} type="button" disabled={playing||imagesBusy}
      className={productionMode===mode?s.modeActive:s.modeButton}
      onClick={()=>chooseMode(mode)}>
      <strong>{AGENT_VIDEO_MODES[mode].name}</strong>
      <span>{mode==="episodes"?"حلقة واحدة في كل تصدير، مع إمكانية إعادة استخدام الشخصيات":
       mode==="short-series"?"قصة قصيرة متعددة المشاهد":"فيديو سريع عمودي أو أفقي"}</span>
     </button>)}
   </div>
   {productionMode==="episodes"&&<label className={s.field}>رقم الحلقة
    <input type="number" value={episode} min={1} max={999}
     disabled={playing} onChange={e=>setEpisode(Math.max(1,Math.min(999,Number(e.target.value)||1)))}/>
   </label>}
   <div className={s.notice}>الأوضاع تنظّم المونتاج والمشاهد. تحويل الصور إلى ممثلين متحركين يتكلمون
    يحتاج محرك فيديو توليدي خارجي غير مفعّل في هذه النسخة؛ ولن ندّعي أنه تم.</div>
  </section>
  <section className={s.panel} style={{marginBottom:16}}>
   <h2>1. مكتبة الشخصيات الثابتة</h2>
   <p>حمّل صورة مرجعية واحدة لكل شخصية. ستظهر الصورة نفسها في جميع المشاهد المرتبطة بها.
    البحث على الإنترنت مخصص للخلفيات فقط، وليس لجلب صور وجوه مختلفة لنفس الشخصية.</p>
   {cast.map((character)=><div key={character.id} className={s.castCard}>
    <div className={s.clipTop}><strong>{character.name||"شخصية بلا اسم"}</strong>
     <button type="button" className={s.danger} disabled={playing||cast.length===1}
      onClick={()=>{setCast(old=>old.filter(c=>c.id!==character.id));
       photos.current.delete(character.id);
       setCasting(old=>Object.fromEntries(Object.entries(old).map(([k,v])=>
        [k,v===character.id?"":v])));
      }}><Trash2 size={14}/> حذف</button>
    </div>
    <div className={s.clipForm}>
     <label className={s.field}>اسم الشخصية
      <input value={character.name} maxLength={80} disabled={playing}
       onChange={e=>editCast(character.id,{name:e.target.value})}/></label>
     <label className={s.field}>نوع الصوت المطلوب (وصف)
      <input value={character.voiceLabel} maxLength={90} disabled={playing}
       onChange={e=>editCast(character.id,{voiceLabel:e.target.value})}/></label>
     <label className={s.field+" "+s.wide}>الملامح الثابتة
      <textarea value={character.appearance} maxLength={300} disabled={playing}
       onChange={e=>editCast(character.id,{appearance:e.target.value})}/></label>
     <label className={s.field+" "+s.wide}>الملابس الثابتة
      <input value={character.wardrobe} maxLength={200} disabled={playing}
       onChange={e=>editCast(character.id,{wardrobe:e.target.value})}/></label>
     <label className={s.field+" "+s.wide}>صورة الشخصية الثابتة
      <input type="file" accept="image/png,image/jpeg,image/webp"
       disabled={playing} onChange={e=>uploadCastPhoto(character.id,e)}/>
      <span className={s.small}>{photos.current.has(character.id)?"تم تثبيت الصورة محليًا للمشاهد المرتبطة":"لم ترفع صورة مرجعية بعد"}</span>
     </label>
    </div>
   </div>)}
   <div className={s.buttonRow}>
    <button type="button" className={s.secondary} disabled={playing||cast.length>=15}
     onClick={addCastMember}><Plus size={14}/> إضافة شخصية</button>
    <button type="button" className={s.secondary} disabled={playing}
     onClick={()=>downloadText(castBibleAsJson(cast),"agent-character-bible.json","application/json")}>
     <Save size={14}/> حفظ الشخصيات</button>
    <button type="button" className={s.secondary} disabled={playing}
     onClick={()=>castFileRef.current?.click()}><RefreshCw size={14}/> استعادة الشخصيات</button>
    <input ref={castFileRef} type="file" hidden accept=".json,application/json"
     onChange={e=>void importCast(e)}/>
   </div>
   {castNotice&&<div className={s.success} role="status">{castNotice}</div>}
   <div className={s.notice}>صور الشخصيات لا تخرج من متصفحك ولا تُحفظ في ملف JSON.
    بعد فتح مشروع جديد أعد رفعها. يتم تثبيت الصورة نفسها، وليس توليد حركة وجه أو تمثيل شفاه.</div>
  </section>
  <section className={s.panel} style={{marginBottom:16}}>
   <h2>2. اكتب القصة واختر عدد المشاهد</h2>
   <p>AGENT يقسم القصة إلى المشاهد المحددة، ويبحث عن صور مناسبة من Wikimedia Commons المرخصة.
    التنفيذ هنا لتركيب الفيديو من صور حقيقية على الإنترنت، وليس توليد ممثلين أو فيديو سينمائي بالذكاء الاصطناعي.</p>
   <div className={s.clipForm}>
    <label className={s.field}>اسم الفيديو
     <input value={name} maxLength={100} disabled={playing||imagesBusy}
      onChange={e=>setName(e.target.value)}/></label>
    <label className={s.field}>عدد المشاهد حسب نوع الإنتاج
     <input type="number" min={currentMode.minCount} max={currentMode.maxCount} value={requestedCount} disabled={playing||imagesBusy}
      onChange={e=>setRequestedCount(Math.max(currentMode.minCount,Math.min(currentMode.maxCount,Number(e.target.value)||1)))}/></label>
    <label className={s.field}>مدة الفيديو المستهدفة بالثواني
     <input type="number" min={12} max={720} step={15} value={requestedSeconds}
      disabled={playing||imagesBusy} onChange={e=>setRequestedSeconds(
       Math.max(12,Math.min(720,Number(e.target.value)||180)))}/></label>
    <label className={s.field+" "+s.wide}>القصة / السيناريو
     <textarea rows={6} maxLength={9000} value={script}
      disabled={playing||imagesBusy} onChange={e=>setScript(e.target.value)}
      placeholder="اكتب قصة مصريّة أو وصف أحداث الفيديو..."/></label>
   </div>
   <div className={s.buttonRow}>
    <button type="button" className={s.button} disabled={playing||imagesBusy}
     onClick={()=>void generateFromStory()}>
     <Film size={15}/> {imagesBusy?"جارٍ البحث عن الصور...":"إنشاء المشاهد وإحضار الصور تلقائيًا"}</button>
    <button type="button" className={s.secondary} disabled={playing||imagesBusy}
     onClick={saveProject}><Save size={15}/> حفظ المشروع</button>
    <button type="button" className={s.secondary} disabled={playing||imagesBusy}
     onClick={()=>fileImportRef.current?.click()}><RefreshCw size={15}/> استعادة مشروع</button>
    <input ref={fileImportRef} type="file" accept=".json,application/json"
     onChange={e=>void importProject(e)} hidden/>
   </div>
   {imageNotice&&<div className={s.success} role="status">{imageNotice}</div>}
  </section>
  <div className={s.layout}>
   <div className={s.panel}>
    <h2>3. حدّد الشخصيات وعدّل المشاهد والصوت</h2>
    <p>الصور المُحضّرة تظهر تلقائيًا، ويمكنك استبدال أي صورة أو تسجيل التعليق الصوتي.</p>
    <div className={s.segment} role="group" aria-label="أبعاد الفيديو">
     <button type="button" className={ratio==="9:16"?s.active:""} disabled={playing}
      onClick={()=>setRatio("9:16")}>9:16 · ريلز وشورتس</button>
     <button type="button" className={ratio==="16:9"?s.active:""} disabled={playing}
      onClick={()=>setRatio("16:9")}>16:9 · يوتيوب</button>
    </div>
    <label className={s.field}>ملف تعليق صوتي أو موسيقى (اختياري)
     <input type="file" accept="audio/*" disabled={playing} onChange={onAudio}/>
     <span className={s.small}>{audioName||"لو رفعت صوت، هيتدمج مع الفيديو عند التصدير؛ غير كده الفيديو صامت."}</span>
    </label>
    <label className={s.field}>
     <span><input type="checkbox" checked={musicEnabled} disabled={playing}
      onChange={e=>setMusicEnabled(e.target.checked)}/> موسيقى خلفية أصلية مجانية داخل الفيديو</span>
    </label>
    <div className={s.buttonRow} style={{marginBottom:16}}>
     <button type="button" className={recordingVoice?s.danger:s.secondary}
      disabled={playing} onClick={()=>void recordVoice()}>
      <Mic size={14}/> {recordingVoice?"إيقاف تسجيل صوتي":"تسجيل تعليق بصوتك"}</button>
     <button type="button" className={s.secondary} onClick={addScene} disabled={playing||scenes.length>=MAX_SCENES}>
      <Plus size={14}/> إضافة مشهد</button>
     <button type="button" className={s.secondary} onClick={downloadScript}><FileText size={14}/> السيناريو</button>
     <button type="button" className={s.secondary} onClick={downloadSubtitles}><FileText size={14}/> ترجمة SRT</button>
     <button type="button" className={s.secondary} onClick={downloadCredits}><FileText size={14}/> حقوق الصور</button>
     <button type="button" className={s.secondary} onClick={downloadShotPlan}><FileText size={14}/> خطة توليد صور وحركة متسقة JSON</button>
     <button type="button" className={s.secondary} onClick={downloadCueSheet}><FileText size={14}/> توقيت حوارات الشخصيات JSON</button>
    </div>
    {scenes.map((clip,index)=><div key={clip.id} className={s.clip}>
     <div className={s.clipTop}><strong>المشهد {index+1} · {clip.duration} ثوانٍ</strong>
      <button type="button" className={s.danger} disabled={playing||scenes.length<=1}
       aria-label={"حذف المشهد "+(index+1)}
       onClick={()=>{images.current.delete(clip.id);shotVideos.current.get(clip.id)?.pause();
        shotVideos.current.delete(clip.id);sceneVoices.current.delete(clip.id);
        setShotVideoNames(old=>{const next={...old};delete next[clip.id];return next;});
        setSceneVoiceNames(old=>{const next={...old};delete next[clip.id];return next;});
        setScenes(old=>old.filter(c=>c.id!==clip.id));}}>
       <Trash2 size={14}/></button>
     </div>
     <div className={s.clipForm}>
      <label className={s.field+" "+s.wide}>الشخصية التي تظهر في هذا المشهد
       <select value={casting[clip.id]||""} disabled={playing}
        onChange={e=>{setCasting(old=>({...old,[clip.id]:e.target.value}));setDownloadUrl(null);}}>
        <option value="">بدون شخصية · خلفية فقط</option>
        {cast.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
       </select>
      </label>
      <label className={s.field}>العنوان
       <input maxLength={80} value={clip.title} disabled={playing}
        onChange={e=>update(clip.id,{title:e.target.value})}/></label>
      <label className={s.field}>المدة (3–25 ثانية)
       <input type="number" min={3} max={25} value={clip.duration} disabled={playing}
        onChange={e=>update(clip.id,{duration:boundedDuration(Number(e.target.value))})}/></label>
      <label className={s.field+" "+s.wide}>النص الظاهر في الفيديو
       <textarea maxLength={500} value={clip.subtitle} disabled={playing}
        onChange={e=>update(clip.id,{subtitle:e.target.value})}/></label>
      <label className={s.field}>الشخصية / الوصف
       <input maxLength={70} value={clip.speaker} disabled={playing}
        onChange={e=>update(clip.id,{speaker:e.target.value})}/></label>
      <div className={s.wide}>
       <button type="button" className={s.secondary} disabled={playing}
        onClick={()=>previewArabicVoice(clip.subtitle)}><Mic size={14}/> سماع النص (معاينة فقط)</button>
      </div>
      <label className={s.field+" "+s.wide}>لقطة فيديو متحركة حقيقية للمشهد (MP4 / WebM)
       <input type="file" accept="video/mp4,video/webm" disabled={playing}
        onChange={e=>onShotVideo(clip.id,e)}/>
       <span className={s.small}>{shotVideoNames[clip.id]||"لا توجد لقطة حركة؛ سيُستخدم رسم الخلفية والشخصية الثابتة."}</span>
      </label>
      <label className={s.field+" "+s.wide}>حوار عربي مسجّل للشخصية في هذا المشهد
       <input type="file" accept="audio/*" disabled={playing}
        onChange={e=>onSceneVoice(clip.id,e)}/>
       <span className={s.small}>{sceneVoiceNames[clip.id]||"لم يرفع حوار لهذا المشهد. صوت المتصفح معاينة فقط."}</span>
      </label>
      <label className={s.field}>لون المشهد
       <input type="color" value={clip.color} disabled={playing}
        onChange={e=>update(clip.id,{color:e.target.value})}/></label>
      <label className={s.field+" "+s.wide}>كلمات بحث الصورة عبر الإنترنت
       <input maxLength={100} value={clip.imageQuery||""} disabled={playing||imagesBusy}
        onChange={e=>update(clip.id,{imageQuery:e.target.value})}/></label>
      <div className={s.wide}>
       <button type="button" className={s.secondary} disabled={playing||imagesBusy}
        onClick={()=>void replaceImage(clip)}><ImagePlus size={14}/> جلب صورة مناسبة</button>
       {clip.imageSource&&<a href={clip.imageSource} target="_blank"
        rel="noopener noreferrer" className={s.sourceLink}>
        مصدر الصورة · {clip.imageLicense||"ترخيص مفتوح"}</a>}
      </div>
      <label className={s.field+" "+s.wide}><span><ImagePlus size={13}/> أو ارفع صورة من جهازك</span>
       <input type="file" accept="image/png,image/jpeg,image/webp" disabled={playing}
        onChange={e=>onImage(clip.id,e)}/>
       {clip.imageUrl&&<span className={s.small}>تم اختيار صورة للمشهد (الصور المحلية لا تُخزّن على الخادم)</span>}
      </label>
     </div>
    </div>)}
   </div>
   <div className={s.panel}>
    <h2><Film size={16}/> 4. معاينة وتصدير الفيديو النهائي</h2>
    <p>{scenes.length} مشاهد · المدة الإجمالية: {total} ثانية · {ratio==="9:16"?"عمودي":"أفقي"}</p>
    <div className={s.preview}>
     <div className={s.frame}>
      <canvas ref={canvasRef} width={540} height={960}
       aria-label="معاينة الفيديو قبل التصدير"/>
     </div>
     <input className={s.progress} aria-label="تقدم تشغيل الفيديو" type="range"
      min={0} max={Math.max(1,total)} step={.1} value={Math.min(progress,total)}
      disabled={playing} onChange={e=>{const time=Number(e.target.value);setProgress(time);
       syncShotVideos(time,false);draw(time);}}/>
     <span className={s.previewMeta}>{Math.round(progress)} / {total} ثانية</span>
     <div className={s.buttonRow}>
      <button type="button" className={s.secondary} onClick={()=>playing?stop():void start(false)}>
       {playing?<Pause size={16}/>:<Play size={16}/>}
       {playing?"إيقاف":"تشغيل المعاينة"}</button>
      <button type="button" className={s.button} disabled={playing}
       onClick={()=>void start(true)}><Video size={16}/>
       {recording?"جارٍ التسجيل...":"تصدير الفيديو"}</button>
     </div>
    </div>
    {downloadUrl&&<div className={s.success}>
     تم تجهيز الفيديو على جهازك. حمّله قبل إغلاق الصفحة.
     <div className={s.buttonRow} style={{marginTop:9}}>
      <a className={s.button} href={downloadUrl}
       download={"agent-"+(productionMode==="episodes"?"episode-"+episode+"-":"video-")+(downloadType.includes("mp4")?"video.mp4":"video.webm")}>
       <Download size={16}/> تحميل الفيديو</a>
     </div>
    </div>}
    {error&&<div className={s.error} role="alert">{error}</div>}
    <div className={s.notice}>تحتاج عملية التصدير نفس مدة الفيديو تقريبًا؛ مثال: فيديو 3 دقائق يستغرق حوالي 3 دقائق.
     الصوت الناتج موسيقى أصلية وحوارات المشاهد التي رفعتها (إن وجدت)، ويمكن إضافة تعليق صوتي مسجل أو مرفوع. النص وحده لا يتحول إلى كلام مسموع تلقائيًا.
     الصوت الأصلي داخل ملفات الفيديو المرفوعة لا يُمزج تلقائيًا؛ ارفع صوت الحوار كملف منفصل. تأكد من جودة الحركة وتزامن الصوت قبل النشر.
     هذه الصور من مصادر مرخّصة مستقلة؛ راجع ملف نسب الحقوق قبل النشر.
     التصدير يستخدم MediaRecorder ودعم الصيغ يختلف حسب المتصفح.
     Chrome وEdge على الكمبيوتر أفضل للتجربة. جودة المخرجات تعتمد على الصور والصوت
     المرفوعين. لا يوجد توليد فيديو AI مدفوع أو نشر تلقائي.</div>
   </div>
  </div>
  <p className={s.footer}>AGENT Preview · لقطات الحركة والصوت والصور المرفوعة محلية · خطة التوليد جاهزة للتسليم لمزوّد معتمد لكن لا توجد خدمة AI فيديو أو TTS مدفوعة مفعّلة</p>
 </section>;
}
