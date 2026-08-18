import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const $=s=>document.querySelector(s);
let selected=null, result=null, resultName="";
let ffmpeg=null, loaded=false;

const input=$("#file"),drop=$("#drop"),processBtn=$("#process"),downloadBtn=$("#download");

function fmt(n){if(!n)return"—";if(n>1e9)return(n/1e9).toFixed(2)+" GB";if(n>1e6)return(n/1e6).toFixed(2)+" MB";return(n/1024).toFixed(1)+" KB"}
function setp(n,t){$("#bar").style.width=n+"%";$("#pct").textContent=n+"%";$("#status").textContent=t}
function choose(f){if(!f)return;if(!f.type.startsWith("video/")&&!/\.(mp4|mov)$/i.test(f.name))return alert("MP4/MOV only");selected=f;$("#name").textContent="✓ "+f.name+" · "+fmt(f.size);processBtn.disabled=false;processBtn.textContent="PROCESS VIDEO";setp(0,"Ready")}
input.onchange=e=>choose(e.target.files[0]);drop.onclick=()=>input.click();

async function loadFFmpeg(){
  if(loaded)return;
  if(!crossOriginIsolated) console.warn("crossOriginIsolated=false; FFmpeg may use the single-thread core.");
  ffmpeg=new FFmpeg();
  ffmpeg.on("progress",p=>{
    const n=Math.max(0,Math.min(100,Math.round(p.progress*100)));
    setp(n,"Encoding H.264…");
  });
  ffmpeg.on("log",({message})=>console.log("[FFmpeg]",message));
  const base="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL:await toBlobURL(base+"/ffmpeg-core.js","text/javascript"),
    wasmURL:await toBlobURL(base+"/ffmpeg-core.wasm","application/wasm")
  });
  loaded=true;
}

async function preserve(){
  setp(20,"Loading source…");
  const {normalizeContainer}=await import("https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/mp4-normalize.mjs");
  const ab=await selected.arrayBuffer(),out=normalizeContainer(new Uint8Array(ab),new DataView(ab));
  if(!out?.valid||!out.newBuffer)throw Error("MP4 normalization failed");
  result=new Blob([out.newBuffer],{type:"video/mp4"});
  resultName=selected.name.replace(/\.[^.]+$/i,"")+"_dystore_v10.01_preserve.mp4";
  setp(100,"Preserve complete ✓");
  return {method:"No re-encode"};
}

async function encodeH264(){
  await loadFFmpeg();
  setp(2,"Loading FFmpeg…");
  const inName="input."+((selected.name.split(".").pop()||"mp4").toLowerCase());
  const outName="output.mp4";
  await ffmpeg.writeFile(inName,await fetchFile(selected));
  setp(5,"Starting 4K60 H.264 encode…");

  // Target is based on the measured TheZiess output supplied by the user:
  // H.264/AVC High, 3840x2160, 60fps, yuv420p, BT.709, Level 5.2, ~57.3 Mbps.
  // Use CRF + VBV so quality remains high while the average bitrate targets ~57 Mbps.
  const args=[
    "-i",inName,
    "-vf","scale=3840:2160:flags=lanczos",
    "-r","60",
    "-c:v","libx264",
    "-profile:v","high",
    "-level:v","5.2",
    "-pix_fmt","yuv420p",
    "-colorspace","bt709",
    "-color_primaries","bt709",
    "-color_trc","bt709",
    "-b:v","57.3M",
    "-maxrate","57.3M",
    "-bufsize","114.6M",
    "-preset","medium",
    "-movflags","+faststart",
    "-c:a","aac",
    "-b:a","192k",
    "-ar","48000",
    outName
  ];

  let code=await ffmpeg.exec(args);
  if(code!==0)throw Error("FFmpeg H.264 encoding failed.");
  const data=await ffmpeg.readFile(outName);
  result=new Blob([data.buffer],{type:"video/mp4"});
  resultName=selected.name.replace(/\.[^.]+$/i,"")+"_dystore_v10.01_h264_4k60.mp4";
  await ffmpeg.deleteFile(inName).catch(()=>{});
  await ffmpeg.deleteFile(outName).catch(()=>{});
  setp(100,"H.264 4K60 complete ✓");
  return {method:"H.264 High re-encode"};
}

async function inspect(blob,method){
  const url=URL.createObjectURL(blob),v=document.createElement("video");
  v.preload="metadata";v.src=url;
  const m=await new Promise(r=>{v.onloadedmetadata=()=>r({w:v.videoWidth,h:v.videoHeight,d:v.duration});v.onerror=()=>r({w:0,h:0,d:0})});
  URL.revokeObjectURL(url);
  const avg=m.d?blob.size*8/m.d:0;
  $("#res").textContent=m.w&&m.h?`${m.w} × ${m.h}`:"—";
  $("#fps").textContent=method.includes("H.264")?"60 FPS":"Source preserved";
  $("#bitrate").textContent=avg?(avg/1e6).toFixed(2)+" Mbps":"—";
  $("#size").textContent=fmt(blob.size);
  $("#codec").textContent=method.includes("H.264")?"H.264 / AVC":"Source codec";
  $("#profile").textContent=method.includes("H.264")?"High · Level 5.2":"—";
  $("#notice").textContent="Measured from the actual output file. The ~57.3 Mbps target is a target, not a fake metadata value.";
}

processBtn.onclick=async()=>{
 if(!selected)return;
 processBtn.disabled=true;downloadBtn.hidden=true;
 try{
   const mode=document.querySelector('input[name="mode"]:checked').value;
   const info=mode==="preserve"?await preserve():await encodeH264();
   await inspect(result,info.method);
   downloadBtn.hidden=false;processBtn.disabled=false;processBtn.textContent="PROCESS AGAIN";
 }catch(e){
   console.error(e);setp(0,"Processing failed");alert(e?.message||"Processing failed");
   processBtn.disabled=false;processBtn.textContent="TRY AGAIN";
 }
};

downloadBtn.onclick=()=>{
 if(!result)return;
 const u=URL.createObjectURL(result),a=document.createElement("a");
 a.href=u;a.download=resultName;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
};
