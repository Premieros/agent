/** Read-only, organization-scoped AGENT facts for conversational questions.
 * No arbitrary SQL, no external accounts, no service-role credentials.
 */
import type {AgentSession} from "@/lib/agent-server";

export async function readAgentWorkspaceFacts(session:AgentSession,prompt:string){
  const {db,organizationId}=session;
  const [leads,chats,pending,recent]=await Promise.all([
    db.from("leads").select("id",{head:true,count:"exact"}).eq("organization_id",organizationId),
    db.from("conversations").select("id",{head:true,count:"exact"}).eq("organization_id",organizationId),
    db.from("handoff_tasks").select("id",{head:true,count:"exact"})
      .eq("organization_id",organizationId).eq("status","pending"),
    db.from("leads").select("full_name,business_name,stage,created_at")
      .eq("organization_id",organizationId)
      .order("created_at",{ascending:false}).limit(5)
  ]);
  const errored=[leads,chats,pending,recent].find(x=>x.error);
  if(errored?.error)throw errored.error;
  const showNames=/(?:آخر|اخر|أحدث|احدث|اسماء|أسماء|مين|who|latest)/iu.test(prompt);
  return [
    "أرقام حالية من قاعدة بيانات AGENT الخاصة بالمؤسسة المصادق عليها. مصدر داخلي للقراءة فقط، لا يشمل حسابات خارجية غير متصلة:",
    "عدد العملاء المسجلين: "+(leads.count??0),
    "عدد محادثات العملاء: "+(chats.count??0),
    "عدد مهام المتابعة المعلقة: "+(pending.count??0),
    ...(showNames?[
      "أحدث العملاء المسجلين (حد أقصى 5):",
      ...(recent.data||[]).map(p=>"- "+String(p.full_name||"").slice(0,90)+
        (p.business_name?" · "+String(p.business_name).slice(0,80):"")+
        " · حالة "+String(p.stage||"غير معروفة"))
    ]:[]),
    "لا تختلق سجلات إضافية أو تعتبر أرقام AGENT أرقام Facebook أو WhatsApp أو أنظمة خارجية."
  ].join("\n");
}
