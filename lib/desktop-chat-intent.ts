/** Conservative, deterministic chat-to-action interpreter.
 * Free-form AI output is never executable. Ambiguous commands are rejected.
 */
export type DesktopChatAction={
  action:"open_url"|"click"|"type_text"|"hotkey";
  arguments:Record<string,unknown>;
  description:string;
};
export function parseDesktopChatCommand(raw:string):DesktopChatAction|null {
  const text=raw.trim();
  if(!text || text.length>1500)return null;
  const directUrl=text.match(/https:\/\/[^\s<>"']+/i)?.[0]?.replace(/[،؛,.!?]+$/,"");
  if(directUrl && /(?:افتح|اذهب|روح|زور|open|visit|browse|متصفح|موقع|رابط)/i.test(text)){
    try{
      const u=new URL(directUrl);
      if(u.protocol!=="https:"||u.username||u.password||u.toString().length>1500)return null;
      return {action:"open_url",arguments:{url:u.toString()},description:"فتح الموقع "+u.hostname+" في المتصفح"};
    }catch{return null;}
  }
  // Examples: 'افتح المتصفح وابحث عن إدارة المخزون', 'ابحث عن أنظمة POS'.
  const search=text.match(/(?:ابحث\s+(?:لي\s+)?(?:عن\s+)?|بحث\s+عن\s+|search(?:\s+for)?\s+)([\s\S]+)/i);
  if(search){
    const query=search[1].trim().replace(/[.،!?]+$/,"").trim();
    if(query.length<2||query.length>300||/https?:\/\//i.test(query))return null;
    return {action:"open_url",arguments:{url:"https://www.google.com/search?q="+encodeURIComponent(query)},
      description:"البحث في Google عن: "+query};
  }
  if(/^(?:افتح\s+(?:لي\s+)?(?:المتصفح|جوجل|google)|open\s+(?:browser|google))\s*[.!؟]?$/i.test(text))
    return {action:"open_url",arguments:{url:"https://www.google.com/"},description:"فتح Google في المتصفح"};
  const type=text.match(/^(?:اكتب|اطبع|type|write)\s*[:：]?\s+([\s\S]+)$/i);
  if(type&&type[1].length<=1200)
    return {action:"type_text",arguments:{text:type[1]},description:"كتابة النص في النافذة النشطة: "+type[1].slice(0,90)};
  const click=text.match(/^(?:اضغط|انقر|click)\s+(?:عند|على|at)?\s*\(?\s*(\d{1,5})\s*[,،\s]\s*(\d{1,5})\s*\)?$/i);
  if(click){
    const x=Number(click[1]),y=Number(click[2]);
    if(x>16000||y>16000)return null;
    return {action:"click",arguments:{x,y},description:"نقرة في الموضع ("+x+", "+y+")"};
  }
  const hotkey=text.match(/^(?:اختصار|اضغط\s+اختصار|hotkey|shortcut)\s+([a-z+\s]+)$/i);
  if(hotkey){
    const keys=hotkey[1].trim().toLowerCase().split(/\s*\+\s*/);
    const allowed=new Set(["enter","tab","esc","ctrl","alt","shift","win","c","v","a","t","w","l","f","s","left","right","up","down","backspace"]);
    if(keys.length>=1&&keys.length<=4&&keys.every(key=>allowed.has(key)))
      return {action:"hotkey",arguments:{keys},description:"اختصار لوحة المفاتيح: "+keys.join("+")};
  }
  return null;
}
