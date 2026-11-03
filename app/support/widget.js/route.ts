import {NextResponse} from "next/server";
export const runtime="nodejs";
const widget=String.raw`(()=>{"use strict";
const script=document.currentScript;
const key=script?.dataset?.widgetKey||"";
if(!/^[a-f0-9]{48}$/.test(key)||document.querySelector("[data-support-ai-root]"))return;
const base=new URL(script.src).origin;
const root=document.createElement("div");root.dataset.supportAiRoot="1";
root.style.cssText="position:fixed;bottom:20px;right:20px;z-index:2147483640;font-family:Arial,sans-serif;direction:rtl";
const shadow=root.attachShadow({mode:"open"});
shadow.innerHTML='<style>*{box-sizing:border-box}button,input{font:inherit}.toggle{border:0;background:#146b89;color:white;border-radius:30px;padding:12px 18px;cursor:pointer;box-shadow:0 6px 18px #0003}.panel{display:none;width:min(360px,calc(100vw - 32px));height:min(480px,calc(100vh - 90px));background:#fff;color:#112232;border-radius:16px;box-shadow:0 12px 40px #0004;overflow:hidden;flex-direction:column;margin-bottom:12px;border:1px solid #ddd}.panel.open{display:flex}.head{padding:14px;background:#146b89;color:white;font-weight:bold}.messages{padding:12px;overflow:auto;flex:1}.bubble{padding:10px;margin:9px 0;border-radius:12px;background:#eef3f5;white-space:pre-wrap;overflow-wrap:anywhere}.mine{background:#d6edf5}.form{display:flex;border-top:1px solid #ddd;padding:8px;gap:5px}input{flex:1;min-width:0;border:1px solid #bbb;border-radius:8px;padding:10px}button.send{border:0;background:#146b89;color:white;padding:8px 12px;border-radius:8px;cursor:pointer}button:disabled{opacity:.5}</style><section class="panel" aria-label="خدمة العملاء"><header class="head">مساعد خدمة العملاء</header><div class="messages" role="log" aria-live="polite"></div><form class="form"><input aria-label="اكتب سؤالك" maxlength="1500" placeholder="اكتب سؤالك..." required/><button class="send" type="submit">إرسال</button></form></section><button class="toggle" type="button" aria-expanded="false">💬 تحدث معنا</button>';
document.body.appendChild(root);
const panel=shadow.querySelector(".panel"),toggle=shadow.querySelector(".toggle"),msgs=shadow.querySelector(".messages"),form=shadow.querySelector("form"),input=shadow.querySelector("input"),send=shadow.querySelector(".send");
toggle.addEventListener("click",()=>{const open=!panel.classList.contains("open");panel.classList.toggle("open",open);toggle.setAttribute("aria-expanded",String(open));if(open)input.focus()});
const storeKey="support-ai:"+base+":"+key;let session;try{session=JSON.parse(sessionStorage.getItem(storeKey)||"null")}catch{session=null}
function append(text,mine){const el=document.createElement("div");el.className="bubble"+(mine?" mine":"");el.textContent=text;msgs.appendChild(el);msgs.scrollTop=msgs.scrollHeight}
async function post(path,body){const r=await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||"تعذر الاتصال");return data}
async function start(){const s=await post("/api/support/public/sessions",{widgetKey:key});session=s;try{sessionStorage.setItem(storeKey,JSON.stringify(s))}catch{}return s}
form.addEventListener("submit",async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;send.disabled=true;input.disabled=true;input.value="";append(text,true);try{if(!session?.conversationId||!session?.visitorToken)await start();let data;try{data=await post("/api/support/public/messages",{widgetKey:key,conversationId:session.conversationId,visitorToken:session.visitorToken,text})}catch(err){if(String(err).includes("جلسة غير صالحة")){session=null;await start();data=await post("/api/support/public/messages",{widgetKey:key,conversationId:session.conversationId,visitorToken:session.visitorToken,text})}else throw err}append(data.answer||"لا توجد إجابة حالياً",false)}catch(err){append(err instanceof Error?err.message:"تعذر الرد الآن",false)}finally{input.disabled=false;send.disabled=false;input.focus()}});
})();`;
export async function GET(){
 return new NextResponse(widget,{headers:{"Content-Type":"application/javascript; charset=utf-8",
 "Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":"*"}});
}
