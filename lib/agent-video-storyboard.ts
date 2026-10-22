/** Offline, deterministic planning and export helpers for AGENT Video Studio.
 * No AI charges, network requests, databases, or external project access.
 */
export type VideoAspect="9:16"|"16:9"|"1:1";
export type VideoTransition="fade"|"slide"|"cut";
export type VideoScene={
 id:number;title:string;subtitle:string;speaker:string;
 duration:number;color:string;transition:VideoTransition;imageUrl?:string;
};
export type VideoDraft={
 version:2;name:string;aspect:VideoAspect;scenes:Omit<VideoScene,"imageUrl">[];
};
export const MAX_VIDEO_SCENES=32;
export const MAX_VIDEO_SCRIPT_CHARS=9000;
const palette=["#7548aa","#b05b60","#177f85","#8f5a39","#315f94","#9960aa"];
const safeText=(x:unknown,limit:number)=>typeof x==="string"?x.trim().slice(0,limit):"";
export const clampSceneDuration=(value:number)=>Number.isFinite(value)
 ?Math.max(3,Math.min(45,Math.round(value))):8;
export const videoDuration=(scenes:readonly VideoScene[])=>
 scenes.reduce((total,scene)=>total+clampSceneDuration(scene.duration),0);

/** Break natural Arabic (or other language) text into editable, bounded visual beats. */
export function splitVideoScript(text:string):string[]{
 if(typeof text!=="string"||text.length>MAX_VIDEO_SCRIPT_CHARS)throw Error("SCRIPT_TOO_LONG");
 const raw=text.trim();
 if(raw.length<12)throw Error("SCRIPT_TOO_SHORT");
 const parts=raw.split(/\n{2,}|\n|(?<=[.!؟؛])\s+/u)
  .map(x=>x.replace(/^(?:المشهد|مشهد|scene)\s*[\d٠-٩A-Za-zأ-ي]+(?:\s*[:：\-–]\s*|\s+)/iu,"").trim())
  .filter(Boolean);
 const beats:string[]=[];
 for(const paragraph of parts){
  let line="";
  for(const word of paragraph.split(/\s+/)){
   if((line+" "+word).trim().length>230&&line){beats.push(line);line=word;}
   else line=line?line+" "+word:word;
  }
  if(line)beats.push(line);
 }
 if(!beats.length)throw Error("SCRIPT_TOO_SHORT");
 if(beats.length<=MAX_VIDEO_SCENES)return beats;
 // Balanced groups preserve all source text instead of silently dropping the ending.
 const merged:string[]=[];
 for(let i=0;i<MAX_VIDEO_SCENES;i++){
  const start=Math.floor(i*beats.length/MAX_VIDEO_SCENES);
  const end=Math.floor((i+1)*beats.length/MAX_VIDEO_SCENES);
  merged.push(beats.slice(start,end).join(" "));
 }
 return merged;
}
export function storyboardFromScript(text:string,targetSeconds=180):VideoScene[]{
 const beats=splitVideoScript(text);
 const requested=Number.isFinite(targetSeconds)?Math.max(30,Math.min(420,Math.round(targetSeconds))):180;
 const targetPerScene=Math.round(requested/beats.length);
 return beats.map((line,i)=>({
  id:i+1,title:"المشهد "+(i+1),
  subtitle:line.slice(0,450),
  speaker:"راوي",duration:clampSceneDuration(Math.max(
    Math.min(45,targetPerScene),Math.min(22,Math.ceil(line.length/13)+4))),
  color:palette[i%palette.length],transition:i===0?"cut":"fade"
 }));
}
export function serializeVideoDraft(name:string,aspect:VideoAspect,scenes:readonly VideoScene[]):string{
 if(!scenes.length||scenes.length>MAX_VIDEO_SCENES)throw Error("INVALID_SCENE_COUNT");
 const draft:VideoDraft={
  version:2,name:safeText(name,100)||"فيديو AGENT",
  aspect,
  scenes:scenes.map(({imageUrl:__imageUrl,...scene})=>({
   ...scene,
   title:safeText(scene.title,110),
   subtitle:safeText(scene.subtitle,500),
   speaker:safeText(scene.speaker,100),
   duration:clampSceneDuration(scene.duration)
  }))
 };
 return JSON.stringify(draft,null,2);
}
export function parseVideoDraft(json:string):VideoDraft{
 if(typeof json!=="string"||json.length>110000)throw Error("INVALID_DRAFT_SIZE");
 const value=JSON.parse(json) as Partial<VideoDraft>;
 if(value?.version!==2||!["9:16","16:9","1:1"].includes(value.aspect||"")||
  !Array.isArray(value.scenes)||value.scenes.length<1||
  value.scenes.length>MAX_VIDEO_SCENES)throw Error("INVALID_VIDEO_DRAFT");
 const scenes=value.scenes.map((input,i)=>{
  if(!input||typeof input!=="object")throw Error("INVALID_VIDEO_SCENE");
  const item=input as VideoScene;
  if(typeof item.title!=="string"||typeof item.subtitle!=="string"||
    typeof item.speaker!=="string"||typeof item.duration!=="number"||
    typeof item.color!=="string"||!/^#[0-9a-f]{6}$/i.test(item.color)||
    !["fade","slide","cut"].includes(item.transition))
    throw Error("INVALID_VIDEO_SCENE");
  return {id:i+1,title:safeText(item.title,110),subtitle:safeText(item.subtitle,500),
   speaker:safeText(item.speaker,100),duration:clampSceneDuration(item.duration),
   color:item.color,transition:item.transition} satisfies Omit<VideoScene,"imageUrl">;
 });
 return {version:2,name:safeText(value.name,100)||"فيديو AGENT",
  aspect:value.aspect as VideoAspect,scenes};
}
function srtTime(value:number){
 const ms=Math.max(0,Math.round(value*1000));
 const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);
 const s=Math.floor((ms%60000)/1000),rest=ms%1000;
 return [h,m,s].map(n=>String(n).padStart(2,"0")).join(":")+","+String(rest).padStart(3,"0");
}
export function videoSrt(scenes:readonly VideoScene[]):string{
 let time=0;
 return scenes.map((scene,i)=>{
  const start=time,finish=time+clampSceneDuration(scene.duration);
  time=finish;
  const text=(scene.subtitle.trim()||scene.title.trim()).replace(/\r/g,"");
  if(!text)return "";
  return String(i+1)+"\n"+srtTime(start+.1)+" --> "+
   srtTime(Math.max(start+.5,finish-.15))+"\n"+text+"\n";
 }).filter(Boolean).join("\n");
}
export function videoScriptDocument(name:string,scenes:readonly VideoScene[]):string{
 let second=0;
 return ["# "+name,"",...scenes.flatMap((scene,i)=>{
  const start=second;second+=clampSceneDuration(scene.duration);
  return ["المشهد "+(i+1)+" | "+start+"–"+second+" ثانية",
   scene.title,scene.speaker+": "+scene.subtitle,""];
 })].join("\n");
}
