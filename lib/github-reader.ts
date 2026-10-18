/**
 * Public GitHub repository reader for AGENT tool calls.
 * - User explicitly chooses a PUBLIC repository.
 * - Never uses a token, never writes, and never follows user-provided URLs.
 * - Repository and branch are checked against GitHub's public metadata.
 * - File paths come from the Git tree and cannot escape the repository.
 */
const API="https://api.github.com/repos/";
const safeRepo=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,60}$/;
const safeBranch=/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const safeFile=/^[A-Za-z0-9_./@+-]{1,220}$/;
const allowedExtensions=/\.(?:ts|tsx|js|jsx|json|md|py|go|rs|sql|css|html|yaml|yml)$/i;
const blockedPath=/(?:^|\/)(?:\.git|\.github|node_modules|vendor|dist|coverage|private|secrets?|__generated__)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*(?:credential|private.key|secret.key|service[_-]?role|keypair|token\.json).*)$/i;
export type PublicRepo={repository:string;branch:string;url:string;description:string;defaultBranch:string};
export type SourceFile={path:string;url:string;lines:number;excerpt:string;truncated:boolean};
export type SourceInspection={repository:string;branch:string;files:SourceFile[];attempted:string[];failed:string[];indexed:number;truncatedTree:boolean};

function safePath(path:string):boolean{
  return safeFile.test(path)&&!path.includes("..")&&!path.includes("\\")&&
    !path.startsWith("/")&&!blockedPath.test(path)&&allowedExtensions.test(path);
}
export function normalizeRepository(value:unknown):string|null{
  if(typeof value!=="string"||value.length>150)return null;
  let slug=value.trim().replace(/\.git$/i,"");
  if(slug.startsWith("https://github.com/"))slug=slug.slice("https://github.com/".length);
  slug=slug.replace(/\/+$/,"");
  return safeRepo.test(slug)?slug:null;
}
const requestHeaders={Accept:"application/vnd.github+json","User-Agent":"Premieros-AGENT-ReadOnly"};
export async function verifyPublicRepository(value:unknown):Promise<PublicRepo>{
  const repository=normalizeRepository(value);
  if(!repository)throw new Error("اسم المستودع غير صحيح. استخدم owner/repository أو رابط GitHub العام.");
  const response=await fetch(API+repository,{
    headers:requestHeaders,redirect:"error",signal:AbortSignal.timeout(6500),cache:"no-store"
  });
  if(!response.ok)throw new Error(response.status===404
    ? "المستودع مش موجود أو خاص. قراءة المستودعات الخاصة تحتاج ربط GitHub بتفويض منفصل."
    : "تعذر فحص المستودع العام من GitHub حاليًا.");
  const result=await response.json() as {
    private?:boolean;archived?:boolean;default_branch?:string;
    html_url?:string;description?:string|null;full_name?:string
  };
  if(result.private===true||result.archived===true)throw new Error("المستودع خاص أو مؤرشف وغير متاح للأداة الحالية.");
  if(result.full_name?.toLowerCase()!==repository.toLowerCase())throw new Error("مستودع GitHub غير متطابق.");
  const branch=result.default_branch||"";
  if(!safeBranch.test(branch)||branch.includes(".."))throw new Error("فرع GitHub غير مدعوم.");
  return {repository:result.full_name||repository,branch,defaultBranch:branch,
    url:"https://github.com/"+repository,description:(result.description||"").slice(0,200)};
}
function rankPaths(paths:string[],query:string):string[]{
  const mentioned=Array.from(query.matchAll(/(?:[\w.-]+\/){1,9}[\w.+-]+\.(?:tsx?|jsx?|json|md|py|go|rs|sql|css|html|ya?ml)\b/gi))
    .map(m=>m[0]).filter(safePath);
  const terms=(query.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g)||[])
    .filter(w=>!["github","file","repo","code","with","from","this","that","please","inspect"].includes(w)).slice(0,18);
  const hints:Array<[RegExp,RegExp]>=[
    [/(مخزون|مخازن|warehouse|stock|inventory|fifo)/i,/(inventory|warehouse|stock|fifo)/i],
    [/(محاسب|حسابات|accounting|ledger|journal)/i,/(account|ledger|journal)/i],
    [/(مبيعات|بيع|sales|sale|كاشير|pos)/i,/(sales|pos|offline|order)/i],
    [/(مشتريات|استلام|purchase|receipt)/i,/(purchase|receipt|procurement)/i],
    [/(تصنيع|وصفات|recipe|bom|costing)/i,/(manufactur|recipe|bom|cost)/i],
    [/(صلاحيات|permission|auth|branch|فرع|فروع)/i,/(auth|branch|permission|access)/i],
    [/(outbox|worker|events|أحداث)/i,/(outbox|worker|event)/i],
    [/(واجهة|صفحة|ui|design|theme|تصميم)/i,/(components|pages|ui|style|css|app)/i]
  ];
  const scored=paths.filter(safePath).map(path=>{
    const p=path.toLowerCase();
    let score=0;
    const mentionedIndex=mentioned.findIndex(v=>v.toLowerCase()===p);
    if(mentionedIndex>=0)score+=1000-mentionedIndex*10;
    const basename=p.split("/").pop()||"";
    for(const word of terms)if(p.includes(word))score+=basename.includes(word)?42:12;
    for(const [test,rx] of hints)if(test.test(query)&&rx.test(p))score+=20;
    if(/(^|\/)(readme|package\.json|pyproject\.toml)/i.test(p))score+=terms.length?3:35;
    if(/(^|\/)(src|app|lib|components|tests)\//i.test(p))score+=5;
    if(/(^|\/)(docs|supabase\/migrations)\//i.test(p))score-=3;
    return {path,score};
  });
  scored.sort((a,b)=>b.score-a.score||a.path.length-b.path.length||a.path.localeCompare(b.path));
  return scored.slice(0,3).map(v=>v.path);
}
export async function inspectGitHubProject(repository:string,branch:string,query:string):Promise<SourceInspection>{
  const slug=normalizeRepository(repository);
  if(!slug||!safeBranch.test(branch)||branch.includes(".."))throw new Error("المستودع أو الفرع غير صحيح.");
  const treeResponse=await fetch(API+slug+"/git/trees/"+encodeURIComponent(branch)+"?recursive=1",{
    headers:requestHeaders,redirect:"error",signal:AbortSignal.timeout(7500),next:{revalidate:180}
  });
  if(!treeResponse.ok)throw new Error("تعذر تحميل فهرس الملفات العام من GitHub.");
  const length=Number(treeResponse.headers.get("content-length")||0);
  if(length>1_500_000)throw new Error("فهرس المستودع كبير جدًا لهذه الأداة.");
  const raw=await treeResponse.text();
  if(raw.length>1_500_000)throw new Error("فهرس المستودع كبير جدًا لهذه الأداة.");
  const listing=JSON.parse(raw) as {truncated?:boolean;tree?:Array<{path?:string;type?:string}>};
  const paths=(listing.tree||[]).filter(f=>f.type==="blob"&&typeof f.path==="string")
    .map(f=>f.path as string).filter(safePath).slice(0,3500);
  const attempted=rankPaths(paths,query);
  const results=await Promise.all(attempted.map(async path=>{
    try{
      const rawUrl="https://raw.githubusercontent.com/"+slug+"/"+encodeURIComponent(branch)+"/"+
        path.split("/").map(encodeURIComponent).join("/");
      const res=await fetch(rawUrl,{headers:{Accept:"text/plain"},
        redirect:"error",signal:AbortSignal.timeout(6500),next:{revalidate:180}});
      if(!res.ok||Number(res.headers.get("content-length")||0)>80_000)return null;
      const fileText=await res.text();
      if(fileText.length>80_000||fileText.includes("\u0000"))return null;
      return {path,url:"https://github.com/"+slug+"/blob/"+encodeURIComponent(branch)+"/"+
        path.split("/").map(encodeURIComponent).join("/"),
        lines:fileText.split("\n").length,
        excerpt:fileText.slice(0,5500),truncated:fileText.length>5500} satisfies SourceFile;
    }catch{return null;}
  }));
  const files=results.filter((f):f is SourceFile=>f!==null);
  return {repository:slug,branch,files,attempted,
    failed:attempted.filter(p=>!files.some(f=>f.path===p)),
    indexed:paths.length,truncatedTree:Boolean(listing.truncated)};
}
