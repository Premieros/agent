/** Browser-only procedural keyframe renderer. Generates original illustrated PNGs,
 * not AI-generated photographs. Reference portraits are composited only locally.
 */
export type ImageSceneStyle="cinematic"|"comic"|"noir";
export type ImageSceneInput={title:string;subtitle:string;sceneId:number;seed:number;style:ImageSceneStyle;aspect:"9:16"|"16:9"};
const normalize=(s:string)=>s.replace(/[إأآ]/g,"ا").replace(/ة/g,"ه").replace(/[\u064b-\u065f]/g,"").toLowerCase();
export function sceneEnvironment(text:string):"sea"|"city"|"nature"|"desert"|"interior"{
 const s=normalize(text);
 if(/بحر|شاطئ|ساحل|موج|اسكندري|ocean|beach|sea/.test(s))return "sea";
 if(/حديق|شجر|غاب|جبل|ورد|nature|forest|park|mountain/.test(s))return "nature";
 if(/صحراء|رمل|اهرام|desert|pyramid/.test(s))return "desert";
 if(/بيت|منزل|غرف|مكتب|مطعم|مدرس|مستشف|قهو|داخل|room|office|home|hospital|classroom|cafe/.test(s))return "interior";
 return "city";
}
function seedRand(seed:number){let x=(seed>>>0)||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function ellipse(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string){
 ctx.beginPath();ctx.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);
 ctx.fillStyle=color;ctx.fill();
}
export function drawSceneArtwork(canvas:HTMLCanvasElement,input:ImageSceneInput,
 portrait?:HTMLImageElement|null):void{
 if(!Number.isInteger(input.sceneId)||input.sceneId<1||!Number.isFinite(input.seed))
  throw Error("INVALID_ARTWORK");
 const w=input.aspect==="9:16"?540:960,h=input.aspect==="9:16"?960:540;
 canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("CANVAS_UNSUPPORTED");
 const rand=seedRand(input.seed ^ (input.sceneId*2654435761));
 const env=sceneEnvironment(input.title+" "+input.subtitle);
 const dark=input.style==="noir";
 const sky=ctx.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,dark?"#101823":input.style==="comic"?"#6676bc":"#102c50");
 sky.addColorStop(.65,dark?"#314054":env==="sea"?"#e7a778":env==="desert"?"#c58a69":"#735486");
 sky.addColorStop(1,dark?"#1d2930":"#302d50");
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 // Atmosphere and sun/moon, deterministic particles
 const sunX=w*(.15+.65*rand()),sunY=h*(.13+.16*rand());
 const glow=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,w*.4);
 glow.addColorStop(0,dark?"#c3d0df55":"#ffdcae8b");glow.addColorStop(1,"#ffffff00");
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ellipse(ctx,sunX,sunY,w*.055,w*.055,dark?"#c1cfdd":"#ffd5a0");
 const horizon=h*(.53+.09*rand());
 if(env==="sea"){
  ctx.fillStyle=dark?"#172b3c":"#1d6381";ctx.fillRect(0,horizon,w,h-horizon);
  for(let i=0;i<110;i++){
   const y=horizon+rand()*(h-horizon),len=(.01+rand()*.16)*w;
   ctx.fillStyle=i%4===0?"#dff4fc9c":"#9dc4d15e";
   ctx.fillRect(rand()*w,y,len,Math.max(1,(y-horizon)/90));
  }
 }else if(env==="desert"||env==="nature"){
  ctx.fillStyle=env==="desert"?"#96654f":"#1d4b4d";
  ctx.beginPath();ctx.moveTo(0,h);
  for(let x=0;x<=w+40;x+=40)ctx.lineTo(x,horizon+(rand()-.3)*h*.22);
  ctx.lineTo(w,h);ctx.fill();
  if(env==="nature")for(let i=0;i<20;i++){
   const x=rand()*w,y=horizon+rand()*(h-horizon);
   ctx.fillStyle="#1a3437";ctx.fillRect(x,y,Math.max(2,w*.007),h*.17);
   ctx.beginPath();ctx.moveTo(x-w*.034,y+h*.035);ctx.lineTo(x+w*.04,y+h*.035);
   ctx.lineTo(x,y-h*.13);ctx.closePath();ctx.fill();
  }
 }else if(env==="interior"){
  ctx.fillStyle=dark?"#2a2b35":"#694e60";ctx.fillRect(0,horizon,w,h-horizon);
  const spacing=w/4;
  for(let i=0;i<3;i++){
   const x=(i+.5)*spacing;
   ctx.fillStyle="#111c30";ctx.fillRect(x,h*.17,spacing*.82,h*.37);
   ctx.fillStyle=dark?"#7f96aa":"#e2a76b";
   ctx.fillRect(x+spacing*.07,h*.2,spacing*.69,h*.3);
   ctx.fillStyle="#15273a";ctx.fillRect(x+spacing*.39,h*.2,spacing*.035,h*.3);
  }
  ctx.fillStyle="#352c35";ctx.fillRect(0,h*.72,w,h*.045);
 }else{
  let x=0;
  while(x<w){
   const bw=w*(.045+rand()*.085),bh=h*(.18+rand()*.39);
   ctx.fillStyle=["#162941","#2a3454","#33304d","#1a354a"][Math.floor(rand()*4)];
   ctx.fillRect(x,horizon-bh,bw,h-horizon+bh);
   for(let xx=x+w*.012;xx<x+bw-w*.008;xx+=w*.023)
    for(let yy=horizon-bh+w*.025;yy<horizon-h*.017;yy+=h*.045){
     if(rand()>.35){ctx.fillStyle=dark?"#a8baca40":"#efbd875c";ctx.fillRect(xx,yy,w*.01,h*.012);}
    }
   x+=bw+w*.004;
  }
  ctx.fillStyle="#2a2938";ctx.fillRect(0,horizon,w,h-horizon);
  ctx.fillStyle="#dbc3a252";ctx.fillRect(w*.46,horizon,w*.075,h-horizon);
 }
 // Cinematic depth and light streaks
 for(let i=0;i<38;i++){
  const x=rand()*w,y=rand()*h,r=(1+rand()*7)*(w/960);
  ellipse(ctx,x,y,r,r,rand()>.55?"#e4c7b145":"#91b2df33");
 }
 const foreground=ctx.createLinearGradient(0,h*.55,0,h);
 foreground.addColorStop(0,"#070e1a00");foreground.addColorStop(1,"#040913bd");
 ctx.fillStyle=foreground;ctx.fillRect(0,h*.55,w,h*.45);
 if(portrait&&portrait.complete&&portrait.naturalWidth>0){
  // Exact same uploaded photo is used for every assigned scene. No fabricated face.
  const pw=w*(input.aspect==="9:16"?.55:.31),ph=h*(input.aspect==="9:16"?.44:.70);
  const px=(w-pw)/2,py=input.aspect==="9:16"?h*.23:h*.15;
  const scale=Math.max(pw/portrait.naturalWidth,ph/portrait.naturalHeight);
  const sx=Math.max(0,(portrait.naturalWidth-pw/scale)/2);
  const sy=Math.max(0,(portrait.naturalHeight-ph/scale)/2);
  ctx.shadowColor="#070c1f";ctx.shadowBlur=18;
  ctx.fillStyle="#172235";ctx.fillRect(px-6,py-6,pw+12,ph+12);ctx.shadowBlur=0;
  ctx.drawImage(portrait,sx,sy,pw/scale,ph/scale,px,py,pw,ph);
  ctx.strokeStyle="#e5bf91";ctx.lineWidth=3;ctx.strokeRect(px,py,pw,ph);
 }
 const vignette=ctx.createRadialGradient(w/2,h/2,w*.05,w/2,h/2,w*.75);
 vignette.addColorStop(0,"#00000000");vignette.addColorStop(1,"#000000a0");
 ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
}
export async function renderSceneArtwork(input:ImageSceneInput,
 portrait?:HTMLImageElement|null):Promise<Blob>{
 const canvas=document.createElement("canvas");
 drawSceneArtwork(canvas,input,portrait);
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
 if(!blob||blob.size<1000)throw Error("ARTWORK_EXPORT_FAILED");
 return blob;
}
