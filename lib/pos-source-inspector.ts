/**
 * First AGENT source-reading tool. Limited to public Premieros/.com, main.
 * The caller is an authenticated AGENT user; this module has NO write actions,
 * shell, Supabase connection, or ability to read environment files.
 */
const ROOT="https://raw.githubusercontent.com/Premieros/.com/main/";
const PREFIXES=["src/","tests/","docs/","supabase/migrations/"];
const EXTENSIONS=/\.(?:ts|tsx|js|jsx|md|sql)$/i;
const SKIP=/(?:^|\/)(?:node_modules|\.git|\.github|secrets?|private|vendor|dist)(?:\/|$)|(?:^|\/)(?:\.env[^/]*|.*(?:password|secret|credentials|token|keypair).*)$/i;
const topicFiles=[
  {rx:/(?:مخزون|مخازن|warehouse|inventory|stock|fifo)/i,
    paths:["src/api/domains/inventory.ts","src/core/repositories/warehouseStockProjection.ts","src/core/repositories/InventoryRepository.ts"]},
  {rx:/(?:محاسب|حسابات|accounting|ledger|journal|coa)/i,
    paths:["src/api/domains/accounting.ts","src/features/accounting/components/ErpAgentReadinessPanel.tsx"]},
  {rx:/(?:مبيعات|بيع|sale|offline|كاشير|pos)/i,
    paths:["src/core/repositories/SalesRepository.ts","src/features/pos/services/offlinePos.ts"]},
  {rx:/(?:مشتريات|استلام|purchase|procurement|receipt)/i,
    paths:["src/features/trade/pages/PurchasesPage.tsx","supabase/migrations/20261011113110_phase6_procurement_receipt_integrity.sql"]},
  {rx:/(?:تصنيع|وصفات|recipe|bom|costing|تكاليف)/i,
    paths:["src/api/domains/costing.ts","src/features/manufacturing/pages/RecipesPage.tsx"]},
  {rx:/(?:صلاحيات|permission|rls|auth|فرع|فروع|branches)/i,
    paths:["src/api/domains/branches.ts","src/app/routes.tsx"]},
  {rx:/(?:outbox|worker|events|الأحداث)/i,
    paths:["supabase/migrations/20261011133446_phase8c_scheduled_verified_event_worker.sql",
      "supabase/migrations/20261011130910_phase8b_verified_event_consumer.sql"]}
] as const;
const defaults=["src/app/routes.tsx","src/api/domains/inventory.ts","src/api/domains/accounting.ts"];
export type SourceFile={path:string;url:string;lines:number;excerpt:string;truncated:boolean};
export type SourceInspection={files:SourceFile[];attempted:string[];failed:string[];summary:string};

function allowed(path:string):boolean {
  return path.length<=180 && !path.includes("..") && !path.includes("\\") &&
    PREFIXES.some(prefix=>path.startsWith(prefix)) &&
    EXTENSIONS.test(path) && !SKIP.test(path) &&
    /^[a-zA-Z0-9_./-]+$/.test(path);
}

function selectPaths(query:string):string[]{
  const supplied=Array.from(query.matchAll(/(?:src\/|tests\/|docs\/|supabase\/migrations\/)[a-zA-Z0-9_./-]+\.(?:tsx?|jsx?|md|sql)\b/g))
    .map(match=>match[0]).filter(allowed);
  // User-chosen paths are prioritized; topical matches fill any remaining slots.
  const selected=[...supplied];
  for(const group of topicFiles){
    if(group.rx.test(query)) selected.push(...group.paths);
  }
  if(selected.length===0)selected.push(...defaults);
  return Array.from(new Set(selected.filter(allowed))).slice(0,3);
}

export async function inspectPosSource(query:string):Promise<SourceInspection>{
  const attempted=selectPaths(query);
  const fetched=await Promise.all(attempted.map(async path=>{
    try{
      const response=await fetch(ROOT+path,{
        headers:{Accept:"text/plain"},
        signal:AbortSignal.timeout(5000),
        next:{revalidate:300}
      });
      if(!response.ok)return null;
      const text=await response.text();
      if(text.length>80000)return null;
      const lines=text.split("\n");
      const excerpt=text.slice(0,4200);
      return {path,
        url:"https://github.com/Premieros/.com/blob/main/"+path,
        lines:lines.length,excerpt,
        truncated:text.length>excerpt.length} satisfies SourceFile;
    }catch{return null;}
  }));
  const files=fetched.filter((f):f is SourceFile=>f!==null);
  return {
    attempted,files,failed:attempted.filter(p=>!files.some(f=>f.path===p)),
    summary: files.length
      ? "Code inspection from public GitHub files: "+files.map(f=>f.path).join(", ")
      : "No source files could be read; do not claim to have inspected source code."
  };
}
