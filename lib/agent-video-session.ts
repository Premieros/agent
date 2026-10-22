import {parseVideoDraft,serializeVideoDraft,type VideoAspect,type VideoScene,type VideoDraft} from "./agent-video-storyboard.ts";
import {AGENT_VIDEO_MODES,parseCastBible,castBibleAsJson,type AgentVideoCharacter,type AgentVideoMode} from "./agent-video-production.ts";

/** AGENT session metadata only. Never serialize browser blobs, uploaded reference faces or audio. */
export type AgentVideoSession={version:3;kind:"agent-video-session";mode:AgentVideoMode;
 episode:number;draft:VideoDraft;characters:AgentVideoCharacter[];
 casting:Record<string,string>;note:string};
export function exportVideoSession(name:string,aspect:VideoAspect,scenes:readonly VideoScene[],
 cast:readonly AgentVideoCharacter[],casting:Readonly<Record<number,string>>,mode:AgentVideoMode,episode:number):string{
 if(!(mode in AGENT_VIDEO_MODES)||!Number.isInteger(episode)||episode<1||episode>999)
  throw Error("INVALID_VIDEO_SESSION");
 const draft=JSON.parse(serializeVideoDraft(name,aspect,scenes)) as VideoDraft;
 const characters=parseCastBible(castBibleAsJson(cast));
 const assign:Record<string,string>={};
 for(const scene of draft.scenes){
  const index=cast.findIndex(character=>character.id===casting[scene.id]);
  if(index>=0&&index<characters.length)assign[String(scene.id)]=characters[index].id;
 }
 const session:AgentVideoSession={version:3,kind:"agent-video-session",mode,episode,
  draft,characters,casting:assign,note:"Local actor photos, motion footage and dialogue audio must be reattached after import."};
 return JSON.stringify(session,null,2);
}
export function importVideoSession(input:string):{
 draft:VideoDraft;cast:AgentVideoCharacter[]|null;casting:Record<number,string>|null;
 mode:AgentVideoMode|null;episode:number|null
}{
 if(input.length>130000)throw Error("INVALID_VIDEO_SESSION");
 const data=JSON.parse(input);
 // Restore legacy AGENT drafts unchanged.
 if(data?.version!==3)return {draft:parseVideoDraft(input),cast:null,casting:null,mode:null,episode:null};
 if(data.kind!=="agent-video-session"||!data.draft||!(data.mode in AGENT_VIDEO_MODES)||
  !Number.isInteger(data.episode)||data.episode<1||data.episode>999||!Array.isArray(data.characters))
  throw Error("INVALID_VIDEO_SESSION");
 const draft=parseVideoDraft(JSON.stringify(data.draft));
 const cast=parseCastBible(JSON.stringify({version:1,type:"agent-character-bible",characters:data.characters}));
 const casting:Record<number,string>={};
 const allowed=new Set(cast.map(c=>c.id));
 if(data.casting&&typeof data.casting==="object"&&!Array.isArray(data.casting)){
  for(const scene of draft.scenes){
   const value=data.casting[String(scene.id)];
   if(typeof value==="string"&&allowed.has(value))casting[scene.id]=value;
  }
 }
 return {draft,cast,casting,mode:data.mode,episode:data.episode};
}
