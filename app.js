const CDN="https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/";
const $=s=>document.querySelector(s);
let selectedFile=null,resultBlob=null,resultName="";
const fileInput=$("#file"),drop=$("#drop"),processBtn=$("#process"),downloadBtn=$("#download"),toast=$("#toast");
function msg(x){toast.textContent=x;toast.classList.add("show");clearTimeout(window.t);window.t=setTimeout(()=>toast.classList.remove("show"),3000)}
function bytes(n){if(!n)return"—";if(n>1073741824)return(n/1073741824).toFixed(2)+" GB";if(n>1048576)return(n/1048576).toFixed(2)+" MB";return(n/1024).toFixed(1)+" KB"}
function rate(n){return n>1e6?(n/1e6).toFixed(2)+" Mbps":n>0?(n/1e3).toFixed(0)+" Kbps":"—"}
function progress(n,t){$("#bar").style.width=n+"%";$("#percent").textContent=n+"%";$("#status").textContent=t}
function choose(f){if(!f)return;if(!/\.(mp4|mov)$/i.test(f.name)&&!f.type.startsWith("video/"))return msg("សូមជ្រើស MP4/MOV");selectedFile=f;$("#fileName").textContent="✓ "+f.name+" · "+bytes(f.size);$("#queue").classList.add("show");$("#queue").textContent="Queued: "+f.name;processBtn.disabled=false;processBtn.textContent="PROCESS VIDEO";progress(0,"Ready to process")}
fileInput.onchange=e=>choose(e.target.files?.[0]);
drop.ondragover=e=>{e.preventDefault();drop.classList.add("drag")};drop.ondragleave=()=>drop.classList.remove("drag");drop.ondrop=e=>{e.preventDefault();drop.classList.remove("drag");choose(e.dataTransfer.files?.[0])};

async function videoMeta(blob){
 const url=URL.createObjectURL(blob),v=document.createElement("video");v.preload="metadata";v.src=url;
 const base=await new Promise(r=>{v.onloadedmetadata=()=>r({w:v.videoWidth,h:v.videoHeight,d:v.duration||0});v.onerror=()=>r({w:0,h:0,d:0})});
 URL.revokeObjectURL(url);
 let x=null;
 try{x=await new Promise(resolve=>{const f=MP4Box.createFile();let ok=false;const done=z=>{if(ok)return;ok=true;resolve(z)};f.onError=()=>done(null);f.onReady=i=>{const t=i.videoTracks?.[0];const a=i.audioTracks||[];if(!t)return done(null);const d=t.track_duration&&t.timescale?t.track_duration/t.timescale:base.d;const s=Number(t.nb_samples)||0;done({w:Number(t.video?.width)||base.w,h:Number(t.video?.height)||base.h,d,fps:s&&d?s/d:0,bitrate:Number(t.bitrate)||0,codec:t.codec||"Unknown",audio:a.length?"Present":"None",samples:s})};blob.arrayBuffer().then(b=>{b.fileStart=0;f.appendBuffer(b);f.flush();setTimeout(()=>done(null),4000)}).catch(()=>done(null))})}catch{}
 const d=x?.d||base.d,avg=d?blob.size*8/d:0;
 return {w:x?.w||base.w,h:x?.h||base.h,d,fps:x?.fps||0,bitrate:x?.bitrate||avg,avg,codec:x?.codec||"Unknown",audio:x?.audio||"Unknown",samples:x?.samples||0,size:blob.size,type:blob.type||"video/mp4",track:!!x?.bitrate}
}
function show(m){$("#outResolution").textContent=m.w&&m.h?`${m.w} × ${m.h}`:"Unknown";$("#outFPS").textContent=m.fps?m.fps.toFixed(2)+" FPS":"Not available";$("#outBitrate").textContent=rate(m.bitrate);$("#outFileSize").textContent=bytes(m.size);$("#outFormat").textContent=m.type;$("#outMethod").textContent="No re-encode";$("#outCodec").textContent=m.codec;$("#outDuration").textContent=m.d?m.d.toFixed(2)+" s":"—";$("#outAudio").textContent=m.audio;$("#outSamples").textContent=m.samples?m.samples.toLocaleString():"—";$("#outContainer").textContent="MP4";$("#outIntegrity").textContent="Readable";$("#bitrateNote").textContent=m.track?"Actual video track":"Actual output average";$("#outputNotice").textContent=m.track?"Bitrate read from processed video track.":"Average output bitrate = file size ÷ duration; never copied from the original."}

async function processVideo(){
 if(!selectedFile)return;
 processBtn.disabled=true;downloadBtn.hidden=true;
 const mode=document.querySelector('input[name="mode"]:checked')?.value||"preserve";
 try{
  progress(10,"Reading source…");
  if(mode==="hevc"){
   if(!("VideoEncoder" in window))throw new Error("Real HEVC encoding is not available in this browser. Use Preserve source mode or run native FFmpeg on PC.");
   throw new Error("V9 browser build intentionally does not fake HEVC. A real HEVC MP4 encoder/muxer is required.");
  }
  const {normalizeContainer}=await import(CDN+"mp4-normalize.mjs");
  progress(30,"Normalizing MP4 container…");
  const b=await selectedFile.arrayBuffer(),n=normalizeContainer(new Uint8Array(b),new DataView(b));
  if(!n?.valid)throw new Error("Invalid MP4 container.");
  progress(70,"Building output without re-encoding…");
  const out=n.newBuffer;if(!out||out.byteLength<100)throw new Error("Empty output.");
  resultBlob=new Blob([out],{type:"video/mp4"});resultName=selectedFile.name.replace(/\.[^.]+$/i,"")+"_dystore_v9.mp4";
  progress(85,"Inspecting actual output…");const m=await videoMeta(resultBlob);show(m);progress(100,"V9 complete ✓");
  downloadBtn.hidden=false;processBtn.disabled=false;processBtn.textContent="PROCESS AGAIN";msg(`ជោគជ័យ · ${m.w}×${m.h} · ${m.fps?m.fps.toFixed(2):"?"} FPS`);
 }catch(e){console.error(e);progress(0,"Processing failed");processBtn.disabled=false;processBtn.textContent="TRY AGAIN";msg(e.message||"Process failed")}
}
processBtn.onclick=processVideo;
downloadBtn.onclick=()=>{if(!resultBlob)return;const u=URL.createObjectURL(resultBlob),a=document.createElement("a");a.href=u;a.download=resultName;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
