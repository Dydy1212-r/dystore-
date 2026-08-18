import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js";
import { fetchFile } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js";

const CDN="https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/";
const $=s=>document.querySelector(s);
const fileInput=$("#file"),drop=$("#drop"),fileName=$("#fileName"),processBtn=$("#process"),downloadBtn=$("#download");
const statusEl=$("#status"),percentEl=$("#percent"),bar=$("#bar"),queue=$("#queue"),toast=$("#toast");
let selected=null,resultBlob=null,resultName="",ffmpeg=null;

function toastMsg(msg){toast.textContent=msg;toast.classList.add("show");clearTimeout(window._t);window._t=setTimeout(()=>toast.classList.remove("show"),3000)}
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
 fileName.textContent="✓ "+file.name+" · "+fmt(file.size);fileName.style.color="#24d9ff";queue.classList.add("show");queue.textContent="Queued: "+file.name;
 inspect(file);setProgress(0,"Ready to process");
}
fileInput.addEventListener("change",e=>choose(e.target.files[0]));
drop.addEventListener("click",()=>fileInput.click());
["dragenter","dragover"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>choose(e.dataTransfer.files[0]));

document.querySelectorAll(".mode").forEach(m=>m.addEventListener("click",()=>{document.querySelectorAll(".mode").forEach(x=>x.classList.remove("active"));m.classList.add("active");m.querySelector("input").checked=true}));

async function standardExport(){
 setProgress(8,"Loading video encoder…");
 if(!ffmpeg)ffmpeg=new FFmpeg();
 if(!ffmpeg.loaded){
   ffmpeg.on("progress",({progress})=>setProgress(20+Math.round(progress*65),"Encoding standard MP4…"));
   await ffmpeg.load({coreURL:"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"});
 }
 const ext=/\.mov$/i.test(selected.name)?"mov":"mp4";
 const input="input."+ext,output="dystore-standard.mp4";
 await ffmpeg.writeFile(input,await fetchFile(selected));
 setProgress(20,"Encoding H.264 + AAC…");
 await ffmpeg.exec(["-i",input,"-map","0:v:0","-map","0:a?","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart","-map_metadata","-1",output]);
 setProgress(90,"Preparing download…");
 const data=await ffmpeg.readFile(output);
 await ffmpeg.deleteFile(input);await ffmpeg.deleteFile(output);
 return new Blob([data.buffer],{type:"video/mp4"});
}

async function fastPatch(){
 setProgress(10,"Reading video…");
 const {normalizeContainer}=await import(CDN+"mp4-normalize.mjs");
 const {inflateSampleTableVideo}=await import(CDN+"mp4-inflate.mjs");
 const buffer=await selected.arrayBuffer(),bytes=new Uint8Array(buffer),view=new DataView(buffer);
 setProgress(30,"Normalizing container…");
 const normalized=normalizeContainer(bytes,view);
 if(!normalized.valid)throw new Error("Invalid video container.");
 setProgress(55,"Applying NoBlur patch…");
 const inflated=inflateSampleTableVideo(normalized.newBytes,normalized.newView,10);
 setProgress(90,"Preparing download…");
 return new Blob([inflated.newBuffer],{type:"video/mp4"});
}

async function processVideo(){
 if(!selected)return;
 processBtn.disabled=true;downloadBtn.hidden=true;
 const mode=document.querySelector('input[name="mode"]:checked').value;
 try{
  resultBlob=mode==="standard"?await standardExport():await fastPatch();
  const base=selected.name.replace(/\.[^.]+$/,"");
  resultName=base+(mode==="standard"?"_dystore_standard.mp4":"_dystore_patch.mp4");
  $("#outType").textContent=mode==="standard"?"H.264 + AAC":"NoBlur patched";
  setProgress(100,"Processing complete ✓");downloadBtn.hidden=false;processBtn.textContent="PROCESS AGAIN";
  addHistory(selected.name,resultName,resultBlob.size,mode);toastMsg("ជោគជ័យ! ឯកសារ MP4 រួចរាល់");
 }catch(err){
  console.error(err);setProgress(0,"Processing failed");processBtn.disabled=false;processBtn.textContent="TRY AGAIN";
  toastMsg("Process failed: "+(err?.message||"Unknown error"));
 }
}
processBtn.addEventListener("click",processVideo);
downloadBtn.addEventListener("click",()=>{
 if(!resultBlob)return;const url=URL.createObjectURL(resultBlob),a=document.createElement("a");a.href=url;a.download=resultName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
});
function addHistory(input,output,size,mode){
 const box=$("#historyList");if(box.classList.contains("empty")){box.classList.remove("empty");box.innerHTML=""}
 const row=document.createElement("div");row.className="historyRow";row.innerHTML=`<span>✓ ${input} → ${output} · ${mode}</span><span>${fmt(size)}</span>`;box.prepend(row);
}
$("#userBtn").addEventListener("click",()=>toastMsg("dystore · FREE account"));
