"use strict";
// Trusted AGENT acceptance suite: independent of code and tests in the ZIP.
// Mounted outside /workspace by CI and by GitHub's isolated-runner workflow.
const test=require("node:test"),assert=require("node:assert/strict");
const kind=process.env.AGENT_ACCEPTANCE_KIND;
const root=process.env.AGENT_WORKSPACE_ROOT||"/workspace";
if(!["inventory","task_board"].includes(kind))throw Error("UNSUPPORTED_ACCEPTANCE_KIND");
const serverModule=require(root+"/server.js");
const Inventory=kind==="inventory"?require(root+"/src/inventory.js").Inventory:null;
function server(){
 if(kind==="inventory")return serverModule.createServer(new Inventory());
 return serverModule.server;
}
test("independent owner acceptance: real Arabic app and HTTP lifecycle",async()=>{
 const app=server();
 assert.ok(app&&typeof app.listen==="function");
 await new Promise((done,reject)=>{app.once("error",reject);app.listen(0,"127.0.0.1",done);});
 const base="http://127.0.0.1:"+app.address().port;
 async function req(url,method="GET",data){
  const reply=await fetch(base+url,{method,...(data?{headers:{"content-type":"application/json"},body:JSON.stringify(data)}:{})});
  return {status:reply.status,body:await reply.text()};
 }
 try{
  const home=await req("/");
  assert.equal(home.status,200);
  assert.match(home.body,kind==="inventory"?/مخزون|إدارة المخزون/:/مهام|إدارة المهام/);
  const js=await req("/app.js");
  assert.equal(js.status,200);
  const css=await req("/style.css");
  assert.equal(css.status,200);
  if(kind==="inventory"){
   let result=await req("/api/products","POST",{name:"مخزون",price:12,quantity:10});
   assert.equal(result.status,201);const item=JSON.parse(result.body);
   const id=item.id;assert.ok(id);
   result=await req("/api/products/"+id+"/sale","POST",{quantity:11});
   assert.equal(result.status,400);
   assert.match(result.body,/INSUFFICIENT_STOCK/);
   result=await req("/api/products/"+id+"/supply","POST",{quantity:5});
   assert.equal(result.status,200);
   assert.equal(JSON.parse(result.body).quantity,15);
   result=await req("/api/products/"+id+"/sale","POST",{quantity:3});
   assert.equal(result.status,200);assert.equal(JSON.parse(result.body).quantity,12);
   result=await req("/api/products/"+id+"/supply","POST",{quantity:"3"});
   assert.notEqual(result.status,200); // Reject coercion to string concatenation
   result=await req("/api/products");assert.equal(JSON.parse(result.body)[0].quantity,12);
   result=await req("/api/movements");
   assert.deepEqual(JSON.parse(result.body).map(x=>x.type),["ADD","SUPPLY","SALE"]);
  }else{
   let result=await req("/api/tasks","POST",{title:"اختبار"});
   assert.equal(result.status,201);
   const id=JSON.parse(result.body).id;
   result=await req("/api/tasks");
   assert.equal(JSON.parse(result.body).length,1);
   result=await req("/api/tasks/"+id,"PATCH",{done:true});
   assert.equal(result.status,200);assert.equal(JSON.parse(result.body).done,true);
   result=await req("/api/tasks/"+id,"DELETE");
   assert.equal(result.status,200);
   result=await req("/api/tasks");assert.equal(JSON.parse(result.body).length,0);
  }
 }finally{await new Promise(ok=>app.close(ok));}
});
