/** Local, provider-neutral handoff for consistent episodic video production.
 * No network calls, credentials, database access or automatic purchases.
 * Image/video prompts do NOT contain reference photo bytes or local blob URLs.
 */
export type ShotScene={id:number;title:string;subtitle:string;speaker:string;duration:number};
export type ShotCharacter={id:string;name:string;appearance:string;wardrobe:string;voiceLabel:string};
export type ShotPlan={version:1;kind:"agent-video-shot-plan";status:"requires-provider-and-consent";
 provider:"not-configured";mode:string;episode:number;aspect:"9:16"|"16:9";
 referencePolicy:{photos:"browser-only";externalUpload:"requires-separate-explicit-consent"};
 shots:{sceneId:number;durationSeconds:number;characterId:string|null;characterName:string|null;
  referenceRequired:boolean;imagePrompt:string;videoPrompt:string;
  speech:{speaker:string;text:string;voiceDirection:string;startSeconds:number;endSeconds:number}}[];
 limitations:string[]};
const clean=(value:unknown,max:number)=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const seconds=(n:number)=>Number.isFinite(n)?Math.max(3,Math.min(45,Math.round(n))):8;
export function createShotPlan(scenes:readonly ShotScene[],cast:readonly ShotCharacter[],
 casting:Readonly<Record<number,string>>,mode:string,episode:number,aspect:"9:16"|"16:9"):ShotPlan{
 if(!scenes.length||scenes.length>32||cast.length>15)throw Error("INVALID_SHOT_PLAN");
 if(!["reel","short-series","episodes"].includes(mode)||!Number.isInteger(episode)||episode<1||episode>999||
  !["9:16","16:9"].includes(aspect))throw Error("INVALID_SHOT_PLAN");
 let time=0;
 const shots=scenes.map(scene=>{
  if(!Number.isInteger(scene.id)||scene.id<1)throw Error("INVALID_SHOT_SCENE");
  const duration=seconds(scene.duration),start=time;time+=duration;
  const character=cast.find(c=>c.id===casting[scene.id]);
  const identity=character?
   "Character identity LOCKED to the user's separate reference portrait for ID "+clean(character.id,40)+
   " ("+clean(character.name,80)+"). Appearance: "+clean(character.appearance,300)+
   ". Wardrobe: "+clean(character.wardrobe,200)+
   ". Keep the SAME face, age, hair, build, wardrobe and identity in every shot. Do not replace or invent a face.":
   "No recurring character is required in this shot.";
  const sceneText=clean(scene.subtitle,500);
  const context="Arabic-language dramatic scene: "+clean(scene.title,110)+
   ". Story action / dialogue: "+sceneText+". "+identity;
  return {sceneId:scene.id,durationSeconds:duration,characterId:character?.id||null,
   characterName:character?.name||null,referenceRequired:!!character,
   imagePrompt:context+" Still keyframe, coherent lighting and location, realistic cinematography, no text or watermark.",
   videoPrompt:context+" Live-action moving video with meaningful physical action, camera motion, natural gestures and temporally coherent facial identity. "+
    "If speaking, natural Arabic lip synchronization. No slideshow, zoomed still or text overlays.",
   speech:{speaker:character?.name||clean(scene.speaker,100)||"الراوي",
    text:sceneText,voiceDirection:character?.voiceLabel||"Arabic clear natural speech",
    startSeconds:start,endSeconds:time}};
 });
 return {version:1,kind:"agent-video-shot-plan",status:"requires-provider-and-consent",
  provider:"not-configured",mode,episode,aspect,
  referencePolicy:{photos:"browser-only",externalUpload:"requires-separate-explicit-consent"},
  shots,limitations:[
   "This is a generation plan, not generated images or video.",
   "No provider/API, payment, remote asset upload or voice-cloning is active.",
   "Reference portraits are not embedded. Provide them only after provider consent and cost review.",
   "Generated clips need human review for identity continuity, lips and copyright."
  ]};
}
export function audioCueSheet(plan:ShotPlan){
 return plan.shots.map(s=>({sceneId:s.sceneId,characterId:s.characterId,
  speaker:s.speech.speaker,text:s.speech.text,voiceDirection:s.speech.voiceDirection,
  startSeconds:s.speech.startSeconds,endSeconds:s.speech.endSeconds,
  maximumVoiceDurationSeconds:s.durationSeconds}));
}
export function elapsedSceneAt(scenes:readonly Pick<ShotScene,"id"|"duration">[],elapsed:number){
 let start=0;
 for(let i=0;i<scenes.length;i++){
  const end=start+seconds(scenes[i].duration);
  if(i===scenes.length-1||elapsed<end)return {sceneId:scenes[i].id,offset:Math.max(0,elapsed-start),start,end};
  start=end;
 }
 return null;
}
