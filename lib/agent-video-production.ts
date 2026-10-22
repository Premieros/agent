/** Local character continuity and production modes for AGENT Video Studio.
 * Uploaded reference photos stay in the browser and are never searched online.
 */
export type AgentVideoMode="reel"|"short-series"|"episodes";
export type AgentVideoCharacter={
 id:string;name:string;appearance:string;wardrobe:string;voiceLabel:string;
};
export const AGENT_VIDEO_MODES={
 reel:{name:"ريل سريع",defaultCount:6,defaultDuration:45,minCount:1,maxCount:12},
 "short-series":{name:"مسلسل قصير",defaultCount:12,defaultDuration:180,minCount:3,maxCount:24},
 episodes:{name:"مسلسل متعدد الحلقات",defaultCount:20,defaultDuration:360,minCount:4,maxCount:32}
} as const;
export function getCastForScenes(
 scenes:readonly {id:number;subtitle:string;title:string}[],
 cast:readonly AgentVideoCharacter[],
 mainId:string=""
):Record<number,string>{
 const output:Record<number,string>={};
 for(const scene of scenes){
  const line=scene.subtitle+" "+scene.title;
  const matched=cast.find(c=>c.name.trim().length>1&&line.includes(c.name.trim()));
  output[scene.id]=matched?.id||(cast.some(c=>c.id===mainId)?mainId:cast[0]?.id)||"";
 }
 return output;
}
export function castBibleAsJson(cast:readonly AgentVideoCharacter[]):string{
 if(cast.length>15)throw Error("TOO_MANY_CHARACTERS");
 return JSON.stringify({
  version:1,
  type:"agent-character-bible",
  characters:cast.map(c=>({
   id:String(c.id).slice(0,40),
   name:String(c.name).slice(0,80),
   appearance:String(c.appearance).slice(0,300),
   wardrobe:String(c.wardrobe).slice(0,200),
   voiceLabel:String(c.voiceLabel).slice(0,90)
  })),
  note:"Reference photos are private browser uploads. Re-upload each photo after opening this file."
 },null,2);
}
export function parseCastBible(input:string):AgentVideoCharacter[]{
 if(input.length>30000)throw Error("INVALID_CAST_FILE");
 const value=JSON.parse(input);
 if(value?.version!==1||value?.type!=="agent-character-bible"||
  !Array.isArray(value.characters)||value.characters.length>15)throw Error("INVALID_CAST_FILE");
 const ids=new Set<string>();
 return value.characters.map((item:unknown,index:number)=>{
  if(!item||typeof item!=="object")throw Error("INVALID_CHARACTER");
  const c=item as Record<string,unknown>;
  const sanitize=(v:unknown,limit:number)=>
   typeof v==="string"?v.trim().slice(0,limit):"";
  const name=sanitize(c.name,80);
  if(!name)throw Error("INVALID_CHARACTER_NAME");
  const id="cast-"+(index+1);
  ids.add(id);
  return {id,name,appearance:sanitize(c.appearance,300),
   wardrobe:sanitize(c.wardrobe,200),voiceLabel:sanitize(c.voiceLabel,90)};
 });
}
