const CDN="https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/";
const V8_TARGET = { width: 3840, height: 2160, fps: 60, bitrate: 52000000 };
const $=s=>document.querySelector(s);

const fileInput=$("#file"),drop=$("#drop"),fileName=$("#fileName");
const processBtn=$("#process"),downloadBtn=$("#download");
const queue=$("#queue"),statusEl=$("#status"),percentEl=$("#percent"),bar=$("#bar");
const toast=$("#toast");

let selectedFile=null,resultBlob=null,resultName="";

function toastMsg(m){toast.textContent=m;toast.classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>toast.classList.remove("show"),3200)}
function setProgress(n,m){n=Math.max(0,Math.min(100,n));bar.style.width=n+"%";percentEl.textContent=n+"%";statusEl.textContent=m}
function bytes(n){if(!Number.isFinite(n))return"—";if(n>=1073741824)return(n/1073741824).toFixed(2)+" GB";if(n>=1048576)return(n/1048576).toFixed(2)+" MB";if(n>=1024)return(n/1024).toFixed(1)+" KB";return n+" B"}
function mbps(n){if(!Number.isFinite(n)||n<=0)return"—";return n>=1e6?(n/1e6).toFixed(2)+" Mbps":(n/1e3).toFixed(0)+" Kbps"}

function inspectElement(blob){
  return new Promise(resolve=>{
    const u=URL.createObjectURL(blob),v=document.createElement("video");
    v.preload="metadata";v.muted=true;v.playsInline=true;
    v.onloadedmetadata=()=>{const d={w:v.videoWidth,h:v.videoHeight,dur:Number.isFinite(v.duration)?v.duration:0};URL.revokeObjectURL(u);resolve(d)}
    v.onerror=()=>{URL.revokeObjectURL(u);resolve({w:0,h:0,dur:0})};
    v.src=u;
  });
}

async function inspectMP4(blob){
  const el=await inspectElement(blob);
  let info=null;

  try{
    if(typeof MP4Box!=="undefined"){
      info=await new Promise(resolve=>{
        const f=MP4Box.createFile();let done=false;
        const finish=x=>{if(done)return;done=true;resolve(x)};
        f.onError=()=>finish(null);
        f.onReady=i=>{
          const vt=i.videoTracks?.[0]||null, at=i.audioTracks||[];
          if(!vt){finish(null);return}
          const duration=
            vt.track_duration&&vt.timescale ? vt.track_duration/vt.timescale :
            vt.movie_duration&&vt.movie_timescale ? vt.movie_duration/vt.movie_timescale :
            el.dur;
          const samples=Number(vt.nb_samples)||0;
          const fps=samples>0&&duration>0?samples/duration:0;
          const trackBitrate=Number(vt.bitrate)||0;
          finish({
            w:Number(vt.video?.width)||el.w,
            h:Number(vt.video?.height)||el.h,
            dur:duration||el.dur,
            fps,
            samples,
            codec:vt.codec||"Unknown",
            bitrate:trackBitrate,
            audio:at.length?"Present":"None"
          });
        };
        blob.arrayBuffer().then(b=>{b.fileStart=0;f.appendBuffer(b);f.flush();setTimeout(()=>finish(null),5000)}).catch(()=>finish(null));
      });
    }
  }catch(e){console.warn("MP4 inspection:",e)}

  const duration=Number(info?.dur)>0?info.dur:el.dur;
  const average=duration>0?(blob.size*8)/duration:0;

  return {
    w:Number(info?.w)||el.w,
    h:Number(info?.h)||el.h,
    dur:duration,
    fps:Number(info?.fps)||0,
    samples:Number(info?.samples)||0,
    codec:info?.codec||"Unknown",
    bitrate:Number(info?.bitrate)>0?Number(info.bitrate):average,
    average,
    audio:info?.audio||"Unknown",
    size:blob.size,
    format:blob.type||"video/mp4",
    bitrateIsTrack:Number(info?.bitrate)>0
  };
}

function showOutput(m){
  $("#outResolution").textContent=m.w&&m.h?`${m.w} × ${m.h}`:"Unknown";
  $("#outFPS").textContent=m.fps>0?`${m.fps.toFixed(2)} FPS`:"Not available";
  $("#outBitrate").textContent=mbps(m.bitrate);
  $("#outFileSize").textContent=bytes(m.size);
  $("#outFormat").textContent=m.format;
  $("#outMethod").textContent="No re-encode";
  $("#outCodec").textContent=m.codec;
  $("#outDuration").textContent=m.dur>0?`${m.dur.toFixed(2)} s`:"—";
  $("#outAudio").textContent=m.audio;
  $("#outSamples").textContent=m.samples?m.samples.toLocaleString():"—";
  $("#outContainer").textContent="MP4";
  $("#outIntegrity").textContent="Readable";
  $("#bitrateNote").textContent=m.bitrateIsTrack?"Actual video track":"Actual output average";
  $("#outputNotice").textContent=
    m.bitrateIsTrack
      ?"Output bitrate is read from the processed video track."
      :"MP4Box did not expose a video-track bitrate, so this is the actual average output bitrate (file size ÷ duration).";
}

function choose(file){
  if(!file)return;
  const ok=/\.(mp4|mov)$/i.test(file.name)||file.type.startsWith("video/");
  if(!ok){toastMsg("សូមជ្រើសរើស MP4 ឬ MOV");return}
  selectedFile=file;resultBlob=null;downloadBtn.hidden=true;
  processBtn.disabled=false;processBtn.textContent="PROCESS VIDEO";
  fileName.textContent=`✓ ${file.name} · ${bytes(file.size)}`;fileName.style.color="#24d9ff";
  queue.classList.add("show");queue.textContent=`Queued: ${file.name} · ${bytes(file.size)}`;
  setProgress(0,"Ready to process");
}

fileInput.addEventListener("change",e=>choose(e.target.files?.[0]));
["dragenter","dragover"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>choose(e.dataTransfer.files?.[0]));

async function processVideo(){
  if(!selectedFile)return;
  processBtn.disabled=true;downloadBtn.hidden=true;

  const mode=document.querySelector('input[name="mode"]:checked')?.value||"preserve";

  try{
    setProgress(8,"Reading source video…");

    if(mode==="hevc"){
      if(!("VideoEncoder" in window) || !("VideoDecoder" in window)){
        throw new Error("HEVC browser encoding is not available on this device. Use Preserve source mode.");
      }
      /*
        V8 does not pretend that WebCodecs can encode HEVC everywhere.
        A true MP4 HEVC muxer is required to produce a downloadable MP4.
        Until a compatible muxer is present, do not silently create a
        low-quality H.264/720p substitute.
      */
      throw new Error("HEVC MP4 export is not available in this browser build yet. Preserve source mode keeps the original stream.");
    }

    const {normalizeContainer}=await import(CDN+"mp4-normalize.mjs");
    const buffer=await selectedFile.arrayBuffer();
    const input=new Uint8Array(buffer);
    const view=new DataView(buffer);

    setProgress(30,"Normalizing MP4 container…");

    const normalized=normalizeContainer(input,view);
    if(!normalized?.valid)throw new Error("Invalid MP4 container.");

    const out=normalized.newBuffer;
    if(!out||out.byteLength<100)throw new Error("Empty processed output.");

    resultBlob=new Blob([out],{type:"video/mp4"});
    resultName=selectedFile.name.replace(/\.[^.]+$/i,"")+"_dystore_v8.mp4";

    setProgress(78,"Measuring actual V8 output…");
    const meta=await inspectMP4(resultBlob);

    showOutput(meta);
    setProgress(100,"V8 processing complete ✓");
    downloadBtn.hidden=false;
    processBtn.disabled=false;
    processBtn.textContent="PROCESS AGAIN";

    addHistory(resultName,meta);
    toastMsg(`ជោគជ័យ · ${meta.w}×${meta.h} · ${meta.fps?meta.fps.toFixed(2):"?"} FPS`);
  }catch(e){
    console.error(e);
    setProgress(0,"Processing failed");
    processBtn.disabled=false;
    processBtn.textContent="TRY AGAIN";
    toastMsg("Process failed: "+(e?.message||"Unknown error"));
  }
}
processBtn.addEventListener("click",processVideo);

downloadBtn.addEventListener("click",()=>{
  if(!resultBlob)return;
  const u=URL.createObjectURL(resultBlob),a=document.createElement("a");
  a.href=u;a.download=resultName;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
});

function addHistory(name,m){
  const box=$("#historyList");
  if(box.classList.contains("empty")){box.classList.remove("empty");box.innerHTML=""}
  const row=document.createElement("div");
  row.className="historyRow";
  row.innerHTML=`<span>✓ ${name} · ${m.w}×${m.h} · ${m.fps?m.fps.toFixed(2):"?"} FPS</span><span>${bytes(m.size)}</span>`;
  box.prepend(row);
}

$("#userBtn").addEventListener("click",()=>toastMsg("dystore · FREE account"));
