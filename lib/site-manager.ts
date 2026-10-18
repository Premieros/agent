/**
 * AGENT self-site manager. Fixed resource boundary:
 * - Only Premieros/agent, never Premier.OS or arbitrary user repositories.
 * - Live site checks and public source reads need no GitHub token.
 * - Writes require an optional server-side, repo-scoped GitHub token.
 * - Writes create a REVIEW PR only. No merge, production deploy or DB mutations.
 */
const GITHUB_REPO="Premieros/agent";
const BASE="https://api.github.com/repos/"+GITHUB_REPO;
export const SITE_URL="https://premieros-ai-sales-agent.vercel.app";
const safeFiles=[
  "app/page.tsx","app/workspace-dark.css",
  "components/agent-home.tsx","components/workspace-shell.tsx",
  "components/general-assistant.tsx","components/agent-studio.tsx",
  "components/live-crm.tsx","components/live-inbox.tsx",
  "components/assistant-integrations-hub.tsx","components/assistant-markdown.tsx",
  "components/agent-reply-rule.tsx"
] as const;
export type SiteEdit={path:string;search:string;replace:string};
type GhContent={content:string;sha:string;encoding:string};
export const siteWriteReady=()=>Boolean(process.env.SITE_MANAGER_GITHUB_TOKEN?.trim());
export const isEditable=(path:string)=>safeFiles.some(p=>p===path);
function apiUrl(path:string){return BASE+"/"+path.replace(/^\/+/,"");}
async function github<T>(path:string,options?:{
 method?:"GET"|"POST";data?:unknown;write?:boolean
}):Promise<T>{
  const token=options?.write?process.env.SITE_MANAGER_GITHUB_TOKEN?.trim():undefined;
  if(options?.write&&!token)throw new Error("SITE_MANAGER_TOKEN_MISSING");
  const headers:Record<string,string>={
    Accept:"application/vnd.github+json",
    "Content-Type":"application/json",
    "User-Agent":"AGENT-Self-Site-Review"
  };
  if(token)headers.Authorization="Bearer "+token;
  const res=await fetch(apiUrl(path),{method:options?.method||"GET",
    headers,body:options?.data===undefined?undefined:JSON.stringify(options.data),
    redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!res.ok){
    const message=res.status===401||res.status===403?"GITHUB_PERMISSION_DENIED":
      res.status===404?"GITHUB_RESOURCE_MISSING":
      res.status===409||res.status===422?"GITHUB_CONFLICT":"GITHUB_UNAVAILABLE";
    throw new Error(message);
  }
  return await res.json() as T;
}
export async function getMainRevision(){
  const branch=await github<{object?:{sha?:string}}>("git/ref/heads/main");
  const sha=branch.object?.sha;
  if(!sha||!/^[0-9a-f]{40}$/i.test(sha))throw new Error("GITHUB_REVISION_INVALID");
  return sha;
}
export async function getSiteSource(path:string){
  if(!isEditable(path))throw new Error("SITE_FILE_OUT_OF_SCOPE");
  const data=await github<GhContent>("contents/"+path.split("/").map(encodeURIComponent).join("/")+"?ref=main");
  if(data.encoding!=="base64"||typeof data.content!=="string")throw new Error("GITHUB_ENCODING");
  const raw=Buffer.from(data.content.replace(/\s/g,""),"base64").toString("utf8");
  if(raw.includes("\u0000")||raw.length>110000)throw new Error("SITE_SOURCE_TOO_LARGE");
  return {content:raw,sha:data.sha};
}
export function chooseSiteFile(task:string){
  if(/(?:ألوان|الوان|خلفي|ستايل|تنسيق|css|dark|theme|فونت|خط|تباين|مسافات)/i.test(task))return "app/workspace-dark.css";
  if(/(?:رئيسية|الرئيسيه|dashboard|homepage|الاحصائيات|الإحصائيات)/i.test(task))return "components/agent-home.tsx";
  if(/(?:قائمة|سايدبار|التنقل|sidebar|navigation|القسم|الأقسام)/i.test(task))return "components/workspace-shell.tsx";
  if(/(?:صندوق الوارد|inbox|رسائل العملاء|محادثات العملاء)/i.test(task))return "components/live-inbox.tsx";
  if(/(?:عميل|عملاء|leads|crm|مبيعات)/i.test(task))return "components/live-crm.tsx";
  if(/(?:تسويق|حملات|الوكلاء|studio|creatives|تصميمات)/i.test(task))return "components/agent-studio.tsx";
  if(/(?:إضافة|إضافات|integrations|ربط الخدمات)/i.test(task))return "components/assistant-integrations-hub.tsx";
  return "components/general-assistant.tsx";
}
export function prepareSiteEdits(path:string,edits:unknown,original:string):SiteEdit[]{
  if(!isEditable(path)||!Array.isArray(edits)||edits.length<1||edits.length>3)
    throw new Error("SITE_EDITS_INVALID");
  let current=original;
  const result:SiteEdit[]=[];
  for(const item of edits){
    if(!item||typeof item!=="object")throw new Error("SITE_EDITS_INVALID");
    const v=item as Record<string,unknown>;
    if(v.path!==path||typeof v.search!=="string"||typeof v.replace!=="string")
      throw new Error("SITE_EDITS_INVALID");
    const search=v.search;
    const replace=v.replace;
    if(!search.trim()||search.length>2600||replace.length>5000||
      search===replace||current.indexOf(search)<0||
      current.indexOf(search)!==current.lastIndexOf(search))
      throw new Error("SITE_EDITS_INVALID");
    current=current.replace(search,replace);
    result.push({path,search,replace});
  }
  if(current.length>120000)throw new Error("SITE_EDITS_TOO_LARGE");
  return result;
}
export function applySiteEdits(content:string,edits:SiteEdit[]):string{
  let updated=content;
  for(const edit of edits){
    if(!isEditable(edit.path)||!edit.search||edit.search===edit.replace||
      updated.indexOf(edit.search)<0||
      updated.indexOf(edit.search)!==updated.lastIndexOf(edit.search))
      throw new Error("SITE_SOURCE_CHANGED");
    updated=updated.replace(edit.search,edit.replace);
  }
  return updated;
}
export async function siteDiagnostics(){
  const result:{url:string;homepage:{ok:boolean;status:number|null};github:{
    revision:string|null;ci:string;ciLink:string|null
  };writeReady:boolean}={
    url:SITE_URL,homepage:{ok:false,status:null},
    github:{revision:null,ci:"unknown",ciLink:null},writeReady:siteWriteReady()
  };
  const [site,head,runs]=await Promise.allSettled([
    fetch(SITE_URL+"/",{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(7000)}),
    getMainRevision(),
    github<{workflow_runs?:Array<{head_sha:string;status:string;conclusion:string|null;html_url:string}>}>("actions/runs?branch=main&per_page=3")
  ]);
  if(site.status==="fulfilled"){
    result.homepage={ok:site.value.ok,status:site.value.status};
    try{await site.value.body?.cancel();}catch{/* no body to keep */}
  }
  if(head.status==="fulfilled")result.github.revision=head.value;
  if(runs.status==="fulfilled"){
    const run=runs.value.workflow_runs?.find(r=>r.head_sha===result.github.revision);
    if(run){result.github.ci=run.conclusion||run.status;result.github.ciLink=run.html_url;}
  }
  return result;
}
export async function createReviewPullRequest(id:string,title:string,summary:string,
 baseSha:string,edits:SiteEdit[]):Promise<string>{
  if(!siteWriteReady())throw new Error("SITE_MANAGER_TOKEN_MISSING");
  if(!/^[0-9a-f-]{36}$/i.test(id)||!Array.isArray(edits)||!edits.length)throw new Error("SITE_EDITS_INVALID");
  if(await getMainRevision()!==baseSha)throw new Error("SITE_SOURCE_CHANGED");
  const path=edits[0].path;
  if(!isEditable(path)||edits.some(e=>e.path!==path))throw new Error("SITE_EDITS_INVALID");
  const source=await getSiteSource(path);
  const newContent=applySiteEdits(source.content,prepareSiteEdits(path,edits,source.content));
  const originalCommit=await github<{tree:{sha:string}}>("git/commits/"+baseSha);
  const tree=await github<{sha:string}>("git/trees",{method:"POST",write:true,
    data:{base_tree:originalCommit.tree.sha,
      tree:[{path,mode:"100644",type:"blob",content:newContent}]}});
  const commit=await github<{sha:string}>("git/commits",{method:"POST",write:true,
    data:{message:"site: "+title.slice(0,65),tree:tree.sha,parents:[baseSha]}});
  const branch="agent/site-review-"+id.slice(0,8);
  await github<{ref:string}>("git/refs",{method:"POST",write:true,
    data:{ref:"refs/heads/"+branch,sha:commit.sha}});
  const pr=await github<{html_url:string}>("pulls",{method:"POST",write:true,
    data:{base:"main",head:branch,title:"[AGENT Review] "+title.slice(0,80),
      body:"## طلب إدارة الموقع\n\n"+summary.slice(0,1300)+
      "\n\nالملف: "+path+"\n\nهذه مسودة للمراجعة فقط. لم يتم دمجها أو نشرها."}});
  return pr.html_url;
}
