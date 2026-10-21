import {INVENTORY_RECIPE} from "./agent-inventory-recipe.ts";
/** Audited deterministic recipe for exact generic requests. No AI call, no user content embedded. */
import type {ProjectSpec} from "./agent-project-engine";
export function normalizedProjectTask(task:string):string{
 return task.normalize("NFKC").toLocaleLowerCase("ar")
  .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
  .replace(/[؟?!.،,]/g," ").replace(/\s+/g," ").trim().slice(0,4500);
}
const exact=new Set([
 "ابن تطبيق اداره مهام","ابني تطبيق اداره مهام","انشئ تطبيق اداره مهام",
 "اعمل تطبيق اداره مهام","اصنع تطبيق اداره مهام",
 "ابن تطبيق قائمه مهام","انشئ تطبيق قائمه مهام",
 "build a todo app","create a todo app","build a task manager app",
 "create a task manager app"
]);
const inventoryExact=new Set([
 "ابن تطبيق اداره مخزون","ابني تطبيق اداره مخزون","انشئ تطبيق اداره مخزون",
 "اصنع تطبيق اداره مخزون","اعمل تطبيق اداره مخزون",
 "ابن تطبيق مخزون متجر","انشئ تطبيق مخزون متجر",
 "build an inventory app","create an inventory app","build a stock management app"
]);
export function builtInProjectRecipe(task:string):ProjectSpec|null{
 const normalized=normalizedProjectTask(task);
 if(exact.has(normalized))return structuredClone(TASK_BOARD);
 if(inventoryExact.has(normalized))return structuredClone(INVENTORY_RECIPE);
 return null;
}
const TASK_BOARD:ProjectSpec={
  "title": "تطبيق إدارة مهام مستقل",
  "steps": [
    "إنشاء وحدات التطبيق",
    "إعداد واجهة المستخدم",
    "اختبار CRUD وHTTP",
    "تجهيز ZIP"
  ],
  "files": [
    {
      "path": "src/tasks.js",
      "content": "let next=1;const records=[];function add(title){if(typeof title!==\"string\"||!title.trim())throw Error(\"Title required\");const t={id:next++,title:title.trim(),done:false};records.push(t);return {...t};}function list(){return records.map(x=>({...x}));}function update(id,done){const t=records.find(x=>x.id===id);if(!t)return null;t.done=Boolean(done);return {...t};}function remove(id){const i=records.findIndex(t=>t.id===id);if(i<0)return false;records.splice(i,1);return true;}module.exports={add,list,update,remove};\n"
    },
    {
      "path": "server.js",
      "content": "const http=require(\"node:http\"),fs=require(\"node:fs\"),path=require(\"node:path\"),tasks=require(\"./src/tasks\");const root=path.join(__dirname,\"public\");function json(res,status,body){res.writeHead(status,{\"content-type\":\"application/json\"});res.end(JSON.stringify(body));}const server=http.createServer(async(req,res)=>{const url=new URL(req.url||\"/\",\"http://localhost\");if(url.pathname.startsWith(\"/api/tasks\")){if(url.pathname===\"/api/tasks\"&&req.method===\"GET\")return json(res,200,tasks.list());let body=\"\";try{for await(const p of req){body+=p;if(body.length>4096)throw Error(\"Too large\");}const data=body?JSON.parse(body):{};if(url.pathname===\"/api/tasks\"&&req.method===\"POST\")return json(res,201,tasks.add(data.title));const id=Number(url.pathname.split(\"/\")[3]);if(!Number.isSafeInteger(id)||id<1)return json(res,400,{error:\"Invalid ID\"});if(req.method===\"PATCH\"){const x=tasks.update(id,data.done);return json(res,x?200:404,x||{error:\"Not found\"});}if(req.method===\"DELETE\"){const found=tasks.remove(id);return json(res,found?200:404,{deleted:found});}}catch{return json(res,400,{error:\"Invalid input\"});}return json(res,405,{error:\"Unsupported operation\"});}const files={\"/\":\"index.html\",\"/app.js\":\"app.js\",\"/style.css\":\"style.css\"};const f=files[url.pathname];if(req.method!==\"GET\"||!f)return json(res,404,{error:\"Not found\"});try{res.writeHead(200,{\"content-type\":f.endsWith(\".html\")?\"text/html\":f.endsWith(\".css\")?\"text/css\":\"text/javascript\"});res.end(fs.readFileSync(path.join(root,f)));}catch{return json(res,500,{error:\"Missing file\"});}});if(require.main===module)server.listen(process.env.PORT||3000,\"127.0.0.1\");module.exports={server};\n"
    },
    {
      "path": "public/index.html",
      "content": "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>مهامي</title><link rel=\"stylesheet\" href=\"/style.css\"></head><body><main><h1>إدارة المهام</h1><form id=\"form\"><input id=\"title\" required placeholder=\"مهمة جديدة\"><button>إضافة</button></form><ul id=\"list\"></ul></main><script src=\"/app.js\"></script></body></html>"
    },
    {
      "path": "public/style.css",
      "content": "body{font:16px sans-serif;background:#0d0e11;color:#dbeaff;margin:3rem}main{max-width:740px;margin:auto}input,button{padding:12px;border-radius:7px}li{padding:9px;border-bottom:1px solid #274663;display:flex;gap:15px;justify-content:space-between}button{cursor:pointer}"
    },
    {
      "path": "public/app.js",
      "content": "const form=document.querySelector(\"#form\"),list=document.querySelector(\"#list\");async function refresh(){const rows=await(await fetch(\"/api/tasks\")).json();list.replaceChildren();for(const t of rows){const li=document.createElement(\"li\"),label=document.createElement(\"span\"),toggle=document.createElement(\"button\"),del=document.createElement(\"button\");label.textContent=t.title+(t.done?\" ✓\":\"\");toggle.textContent=\"تبديل\";toggle.onclick=async()=>{await fetch(\"/api/tasks/\"+t.id,{method:\"PATCH\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({done:!t.done})});await refresh();};del.textContent=\"حذف\";del.onclick=async()=>{await fetch(\"/api/tasks/\"+t.id,{method:\"DELETE\"});await refresh();};li.append(label,toggle,del);list.append(li);}}form.onsubmit=async event=>{event.preventDefault();const title=document.querySelector(\"#title\");await fetch(\"/api/tasks\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({title:title.value})});title.value=\"\";await refresh();};refresh().catch(()=>list.textContent=\"خطأ في جلب المهام\");"
    },
    {
      "path": "test/tasks.test.cjs",
      "content": "const test=require(\"node:test\"),assert=require(\"node:assert/strict\"),tasks=require(\"../src/tasks\"),{server}=require(\"../server\");test(\"CRUD and invalid data\",()=>{assert.throws(()=>tasks.add(\" \"));const t=tasks.add(\"Work\");assert.equal(tasks.list().length,1);assert.equal(tasks.update(t.id,true).done,true);assert.equal(tasks.remove(t.id),true);assert.equal(tasks.list().length,0);});test(\"HTTP and frontend\",async()=>{await new Promise(r=>server.listen(0,\"127.0.0.1\",r));const base=\"http://127.0.0.1:\"+server.address().port;try{const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/إدارة المهام/);const created=await fetch(base+\"/api/tasks\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({title:\"HTTP\"})});assert.equal(created.status,201);const task=await created.json();assert.equal((await(await fetch(base+\"/api/tasks\")).json())[0].id,task.id);assert.equal((await fetch(base+\"/api/tasks/\"+task.id,{method:\"DELETE\"})).status,200);}finally{await new Promise(r=>server.close(r));}});\n"
    }
  ]
};
