/** Decodes untrusted server responses without hiding gateway and authentication errors. */
export async function readAssistantApiJson<T extends Record<string,unknown>>(response:Response):Promise<T>{
 const type=(response.headers.get("content-type")||"").toLowerCase();
 if(!type.includes("application/json")&&!type.includes("+json")){
  if(response.status===401)return Promise.reject(new Error("انتهت الجلسة؛ سجّل الدخول مجددًا."));
  if(response.status===403)return Promise.reject(new Error("تم رفض طلب المساعد (403). تأكد من صلاحيات الجلسة أو حماية معاينة Vercel."));
  if(response.status===404)return Promise.reject(new Error("مسار API غير موجود في هذا الإصدار (404). افتح رابط النسخة الصحيحة وحدّث الصفحة."));
  if(response.status===502||response.status===503||response.status===504)
   return Promise.reject(new Error("خادم تشغيل AGENT غير متاح مؤقتًا (HTTP "+response.status+"). لا تُكرر تنفيذ المهمة حتى تُراجع حالة الخدمة."));
  return Promise.reject(new Error("أعاد الخادم استجابة غير JSON (HTTP "+response.status+"). تحقق من تسجيل الدخول، وحماية معاينة Vercel، وسجل أخطاء الخادم."));
 }
 let value:unknown;
 try{value=await response.json();}
 catch{return Promise.reject(new Error("أعاد خادم AGENT بيانات JSON غير صالحة (HTTP "+response.status+")."));}
 if(value===null||typeof value!=="object"||Array.isArray(value))
  throw new Error("استجابة AGENT غير صالحة: كان يجب إرجاع كائن JSON.");
 return value as T;
}
