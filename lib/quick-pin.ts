/**
 * Browser-only quick privacy lock, NOT an authentication or MFA credential.
 * The existing Supabase login, session verification and RLS remain mandatory.
 * Never store a PIN, Supabase token, or a reusable password here.
 */
export const PIN_ATTEMPT_LIMIT=5;
export const PIN_BLOCK_MS=15*60*1000;
const ITERATIONS=210000;
export type QuickPinRecord={
 version:1;salt:string;verifier:string;failedAttempts:number;blockedUntil:number;
};
export type QuickPinAttempt={ok:boolean;record:QuickPinRecord;blockedUntil:number};

export function normalizePin(value:string):string{
 return value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x0660))
  .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x06f0))
  .replace(/[^0-9]/g,"").slice(0,4);
}
export function validPin(value:string):boolean{return /^[0-9]{4}$/.test(value);}
export function quickPinKey(userId:string):string{
 if(!/^[a-f0-9-]{36}$/i.test(userId))throw new Error("Invalid account");
 return "agent-quick-pin-v1:"+userId.toLowerCase();
}
function hex(bytes:Uint8Array):string{return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");}
function unhex(value:string):Uint8Array{
 const a=new Uint8Array(value.length/2);
 for(let i=0;i<a.length;i++)a[i]=parseInt(value.slice(i*2,i*2+2),16);
 return a;
}
function safeEquals(a:string,b:string):boolean{
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
async function derive(pin:string,userId:string,salt:string):Promise<string>{
 if(!validPin(pin)||!/^[a-f0-9]{32}$/.test(salt))throw new Error("Invalid PIN");
 const key=await crypto.subtle.importKey("raw",
  new TextEncoder().encode(userId.toLowerCase()+":"+pin),
  "PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({
  name:"PBKDF2",salt:unhex(salt) as BufferSource,iterations:ITERATIONS,hash:"SHA-256"
 },key,256);
 return hex(new Uint8Array(bits));
}
export async function createQuickPin(pin:string,userId:string):Promise<QuickPinRecord>{
 quickPinKey(userId);
 if(!validPin(pin))throw new Error("PIN must contain exactly 4 digits");
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
 const verifier=await derive(pin,userId,salt);
 return {version:1,salt,verifier,failedAttempts:0,blockedUntil:0};
}
export function parseQuickPin(raw:string|null):QuickPinRecord|null{
 if(!raw)return null;
 try{
  const r=JSON.parse(raw) as Partial<QuickPinRecord>;
  if(r.version!==1||typeof r.salt!=="string"||!/^[a-f0-9]{32}$/.test(r.salt)||
   typeof r.verifier!=="string"||!/^[a-f0-9]{64}$/.test(r.verifier)||
   !Number.isInteger(r.failedAttempts)||r.failedAttempts!<0||r.failedAttempts!>PIN_ATTEMPT_LIMIT||
   !Number.isSafeInteger(r.blockedUntil)||r.blockedUntil!<0)return null;
  return r as QuickPinRecord;
 }catch{return null;}
}
export async function checkQuickPin(pin:string,userId:string,previous:QuickPinRecord,
 now=Date.now()):Promise<QuickPinAttempt>{
 quickPinKey(userId);
 if(now<previous.blockedUntil)return {ok:false,record:previous,blockedUntil:previous.blockedUntil};
 const verifier=validPin(pin)?await derive(pin,userId,previous.salt):"";
 if(safeEquals(verifier,previous.verifier)){
  const record={...previous,failedAttempts:0,blockedUntil:0};
  return {ok:true,record,blockedUntil:0};
 }
 const failures=(now>=previous.blockedUntil&&previous.blockedUntil>0?0:previous.failedAttempts)+1;
 const blockedUntil=failures>=PIN_ATTEMPT_LIMIT?now+PIN_BLOCK_MS:0;
 const record={...previous,failedAttempts:Math.min(failures,PIN_ATTEMPT_LIMIT),blockedUntil};
 return {ok:false,record,blockedUntil};
}
