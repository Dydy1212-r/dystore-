const NO_BLUR_CDN="https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/";
const {normalizeContainer}=await import(NO_BLUR_CDN+"mp4-normalize.mjs");
const {inflateSampleTableVideo}=await import(NO_BLUR_CDN+"mp4-inflate.mjs");

const $=s=>document.querySelector(s);
const fileInput=$("#file"),drop=$("#drop"),fileName=$("#fileName"),processBtn=$("#process"),downloadBtn=$("#download");
const statusEl=$("#status"),percentEl=$("#percent"),bar=$("#bar"),queue=$("#queue"),toast=$("#toast");
let selected=null, resultBlob=null, resultName="";

function toastMsg(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(window._t);window._t=setTimeout(()=>toast.classList.remove("show"),2600)}
function setProgress(n,msg){n=Math.max(0,Math.min(100,n));bar.style.width=n+"%";percentEl.textContent=n+"%";statusEl.textContent=msg}
function fmt(bytes){if(bytes>=1073741824)return(bytes/1073741824).toFixed(2)+" GB";if(bytes>=1048576)return(bytes/1048576).toFixed(2)+" MB";return(bytes/1024).toFixed(1)+" KB"}

function inspect(file){
 const v=document.createElement("video");v.preload="metadata";v.muted=true;v.playsInline=true;
 v.onloadedmetadata=()=>{$("#resolution").textContent=v.videoWidth+" × "+v.videoHeight;$("#duration").textContent=Number(v.duration).toFixed(2)+"s";$("#size").textContent=fmt(file.size);$("#format").textContent=file.type||"video/mp4";URL.revokeObjectURL(v.src)}
 v.src=URL.createObjectURL(file)
}

function choose(file){
 if(!file)return;
 if(!/\.(mp4|mov)$/i.test(file.name)&&!file.type.startsWith("video/"))return toastMsg("សូមជ្រើសរើស MP4 ឬ MOV");
 selected=file;resultBlob=null;downloadBtn.hidden=true;processBtn.disabled=false;processBtn.textContent="PROCESS VIDEO";
 fileName.textContent="✓ "+file.name+" · "+fmt(file.size);fileName.style.color="#24d9ff";
 queue.classList.add("show");queue.textContent="Queued: "+file.name;
 inspect(file);setProgress(0,"Ready to process");
}

fileInput.addEventListener("change",e=>choose(e.target.files[0]));
drop.addEventListener("click",()=>fileInput.click());
["dragenter","dragover"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>choose(e.dataTransfer.files[0]));

async function processVideo(){
 if(!selected)return;
 processBtn.disabled=true;downloadBtn.hidden=true;
 try{
   setProgress(5,"Reading video…");
   const buffer=await selected.arrayBuffer();
   const bytes=new Uint8Array(buffer);
   const view=new DataView(buffer);
   setProgress(20,"Normalizing MP4/MOV container…");
   const normalized=normalizeContainer(bytes,view);
   if(!normalized.valid)throw new Error("Invalid video container: moov box not found.");
   setProgress(45,"Applying frame-density patch…");
   const inflated=inflateSampleTableVideo(normalized.newBytes,normalized.newView,10);
   setProgress(85,"Building processed file…");
   const out=new Blob([inflated.newBuffer],{type:"video/mp4"});
   if(out.size<100)throw new Error("Processed output is empty.");
   resultBlob=out;
   const base=selected.name.replace(/\.[^.]+$/,"");
   resultName=base+"_dystore.mp4";
   setProgress(100,"Processing complete ✓");
   downloadBtn.hidden=false;
   processBtn.textContent="PROCESS AGAIN";
   addHistory(selected.name,resultName,out.size);
   toastMsg("ជោគជ័យ! វីដេអូបាន process រួចហើយ");
 }catch(err){
   console.error(err);setProgress(0,"Processing failed");
   processBtn.disabled=false;processBtn.textContent="TRY AGAIN";
   toastMsg("Process failed: "+(err?.message||"Unknown error"));
 }
}
processBtn.addEventListener("click",processVideo);

downloadBtn.addEventListener("click",()=>{
 if(!resultBlob)return;
 const url=URL.createObjectURL(resultBlob),a=document.createElement("a");
 a.href=url;a.download=resultName;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);toastMsg("Download started");
});

function addHistory(input,output,size){
 const box=$("#historyList");
 if(box.classList.contains("empty")){box.classList.remove("empty");box.innerHTML=""}
 const row=document.createElement("div");row.className="historyRow";
 row.innerHTML=`<span>✓ ${input} → ${output}</span><span>${fmt(size)}</span>`;box.prepend(row);
}
$("#userBtn").addEventListener("click",()=>toastMsg("dystore · FREE account"));
