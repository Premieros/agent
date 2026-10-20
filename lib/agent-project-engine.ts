/** Pure validation and portable packaging for independent AGENT projects. */
export type ProjectFile={path:string;content:string};
export type ProjectSpec={title:string;steps:string[];files:ProjectFile[]};
const MAX_FILES=22,MAX_FILE=24_000,MAX_TOTAL=115_000;
const allowed=/\.(?:js|mjs|cjs|json|html|css|md|txt|svg)$/i;
export function validProjectPath(path:string):boolean{
  if(typeof path!=="string"||path.length>140||!allowed.test(path)||path.includes("\\"))
    return false;
  const parts=path.split("/");
  return parts.length<=5&&parts.every(p=>/^[a-z0-9][a-z0-9_.-]*$/i.test(p)&&
    p!=="."&&p!==".."&&!p.startsWith(".")&&!["node_modules",".git",".next","vendor"].includes(p.toLowerCase()));
}
export function parseProjectSpec(raw:string):ProjectSpec{
  const cleaned=raw.trim().replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"");
  const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
  if(start<0||end<=start)throw new Error("INVALID_PROJECT_JSON");
  const data=JSON.parse(cleaned.slice(start,end+1)) as Record<string,unknown>;
  const input=data.files;
  if(!Array.isArray(input)||input.length<4||input.length>MAX_FILES)throw new Error("INVALID_PROJECT_FILE_COUNT");
  const seen=new Set<string>(),files:ProjectFile[]=[];
  let total=0;
  for(const item of input){
    if(!item||typeof item!=="object")throw new Error("INVALID_PROJECT_FILE");
    const value=item as Record<string,unknown>;
    const path=value.path,content=value.content;
    if(typeof path!=="string"||!validProjectPath(path)||typeof content!=="string"||
      content.length<1||new TextEncoder().encode(content).length>MAX_FILE)
      throw new Error("INVALID_PROJECT_FILE");
    const normalized=path.toLowerCase();
    if(seen.has(normalized)||normalized==="package.json")throw new Error("DUPLICATE_OR_RESERVED_PROJECT_PATH");
    seen.add(normalized);total+=new TextEncoder().encode(content).length;
    if(total>MAX_TOTAL)throw new Error("PROJECT_TOO_LARGE");
    files.push({path,content});
  }
  if(!files.some(f=>/\.(?:js|mjs|cjs)$/.test(f.path))||
    !files.some(f=>/(?:^|\/)\w[\w.-]*\.test\.(?:js|mjs|cjs)$/.test(f.path)))
    throw new Error("PROJECT_REQUIRES_CODE_AND_TESTS");
  const title=String(data.title||"AGENT independent project").trim().slice(0,100);
  const steps=Array.isArray(data.steps)?data.steps.filter(x=>typeof x==="string")
    .map(x=>String(x).trim().slice(0,160)).filter(Boolean).slice(0,6):[];
  return {title:title||"AGENT independent project",steps:steps.length?steps:
    ["Generate files","Check syntax","Run tests","Repair within approved limits"],files};
}
export function projectStartFile(files:readonly ProjectFile[]):string|null{
  for(const path of ["server.js","src/server.js","index.js","app.js","src/index.js"])
    if(files.some(f=>f.path===path))return path;
  return null;
}
export function packagedProjectFiles(spec:ProjectSpec,task:string,log:string,status:string):ProjectFile[]{
  const start=projectStartFile(spec.files);
  const meta={name:"agent-independent-project",version:"0.0.1",private:true,
    scripts:{test:"node --test",...(start?{start:"node "+start}:{})}};
  const readme=[
    "# "+spec.title,"","Standalone project generated for: "+task.slice(0,2000),
    "","This archive is NOT committed to or deployed from the AGENT repository.",
    "Node.js 22+; no third-party dependencies, npm install, external credentials or network required for tests.",
    "Run `node --test` to check the included tests.",
    start?"Run `node "+start+"` to start the application.":"No server entry point was identified; review the files before running.",
    "","Test status: "+status+". A passing process exit does not prove complete functionality.",
    "No source changes or deployment occurred in AGENT."
  ].join("\n");
  return [...spec.files,{path:"package.json",content:JSON.stringify(meta,null,2)+"\n"},
    {path:"AGENT-README.md",content:readme+"\n"},
    {path:"TEST-RESULTS.txt",content:log.slice(0,14000)||"No tests were run.\n"}];
}
/** Stored ZIP, no compression dependency, correct UTF-8 CRC and nested paths. */
export function zipProjectFiles(files:readonly ProjectFile[]):Uint8Array{
  if(!files.length||files.length>MAX_FILES+3)throw new Error("INVALID_ZIP_FILE_COUNT");
  const encoder=new TextEncoder(),table=new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
  function crc(input:Uint8Array){let c=0xffffffff;for(const b of input)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  const payload:Uint8Array[]=[],directory:Uint8Array[]=[];
  let offset=0;
  for(const file of files){
    if(!validProjectPath(file.path)||typeof file.content!=="string")throw new Error("INVALID_PROJECT_PATH");
    const name=encoder.encode(file.path),data=encoder.encode(file.content);
    if(data.length>MAX_FILE)throw new Error("PROJECT_FILE_TOO_LARGE");
    const checksum=crc(data);
    const local=new Uint8Array(30+name.length),h=new DataView(local.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);
    h.setUint32(14,checksum,true);h.setUint32(18,data.length,true);
    h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);local.set(name,30);
    const cd=new Uint8Array(46+name.length),d=new DataView(cd.buffer);
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);
    d.setUint16(8,0x0800,true);d.setUint32(16,checksum,true);
    d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);
    d.setUint16(28,name.length,true);d.setUint32(42,offset,true);cd.set(name,46);
    payload.push(local,data);directory.push(cd);offset+=local.length+data.length;
  }
  const dirSize=directory.reduce((sum,p)=>sum+p.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);
  v.setUint32(12,dirSize,true);v.setUint32(16,offset,true);
  const bytes=new Uint8Array(offset+dirSize+22);
  let at=0;for(const part of [...payload,...directory,end]){bytes.set(part,at);at+=part.length;}
  return bytes;
}
export function canAdvanceProject(status:string,approved:boolean,attempts:number,maxAttempts:number,deadline:number,now:number):boolean{
  return approved&&now<deadline&&attempts<=maxAttempts&&
    (status==="ready"&&attempts<maxAttempts||status==="repairing"&&attempts<maxAttempts);
}
