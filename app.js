import {
  Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget,
  Mp4OutputFormat, Quality, canEncodeVideo, canEncodeAudio
} from "https://cdn.jsdelivr.net/npm/mediabunny/+esm";

const $ = s => document.querySelector(s);
let selected = null, result = null, resultName = "";

const TARGET_W = 3840;
const TARGET_H = 2160;
const TARGET_FPS = 60;
const TARGET_BITRATE = 57_300_000;
const TARGET_CODEC = "avc1.640034"; // H.264 High Profile, Level 5.2.

const input = $("#file"), drop = $("#drop"), processBtn = $("#process"), downloadBtn = $("#download");

function fmt(n){
  if(!n) return "—";
  if(n>1e9) return (n/1e9).toFixed(2)+" GB";
  if(n>1e6) return (n/1e6).toFixed(2)+" MB";
  return (n/1024).toFixed(1)+" KB";
}
function setp(n,t){$("#bar").style.width=n+"%";$("#pct").textContent=n+"%";$("#status").textContent=t;}
function choose(f){
  if(!f)return;
  if(!f.type.startsWith("video/")&&!/\.(mp4|mov)$/i.test(f.name)) return alert("MP4/MOV only");
  selected=f; $("#name").textContent="✓ "+f.name+" · "+fmt(f.size);
  processBtn.disabled=false; processBtn.textContent="PROCESS VIDEO"; setp(0,"Ready");
}
input.onchange=e=>choose(e.target.files[0]);
drop.onclick=()=>input.click();

async function checkEncoder(){
  if(!("VideoEncoder" in window)){
    $("#engine").textContent="Encoder: WebCodecs unavailable";
    return false;
  }
  try{
    const ok=await canEncodeVideo("avc",{
      width:TARGET_W,height:TARGET_H,
      bitrate:TARGET_BITRATE
    });
    if(ok){
      $("#engine").textContent="Encoder: H.264 WebCodecs available · hardware-first";
      return true;
    }
  }catch(e){console.warn(e)}
  $("#engine").textContent="Encoder: 4K60 H.264 not supported by this browser/device";
  return false;
}

async function processClient(){
  setp(2,"Checking H.264 4K60 encoder…");
  if(!await checkEncoder()){
    throw Error("This browser/device cannot encode H.264 at 3840×2160 60 FPS. Try another browser/device or use Preserve Source.");
  }

  setp(5,"Opening source locally…");
  const inFile = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(selected)
  });

  const out = new Output({
    format: new Mp4OutputFormat({fastStart:"in-memory"}),
    target: new BufferTarget()
  });

  const conversion = await Conversion.init({
    input: inFile,
    output: out,
    tracks: "primary",
    video: {
      width: TARGET_W,
      height: TARGET_H,
      fit: "fill",
      frameRate: TARGET_FPS,
      codec: "avc",
      quality: new Quality({
        bitrate: TARGET_BITRATE,
        bitrateMode: "constant"
      }),
      keyFrameInterval: 2,
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "quality",
      fullCodecString: TARGET_CODEC,
      forceTranscode: true
    },
    audio: {
      codec: "aac",
      bitrate: 192000,
      sampleRate: 48000
    },
    tags: {}
  });

  if(!conversion.isValid){
    const reasons=(conversion.discardedTracks||[]).map(x=>x.reason).join(", ");
    throw Error("Conversion unavailable: "+(reasons||"unsupported codec/track"));
  }

  conversion.onProgress = p => {
    setp(8+Math.round(p*90),"Hardware-first H.264 encoding…");
  };

  await conversion.execute();
  const buffer = out.target.buffer;
  if(!buffer) throw Error("No output file was produced.");

  result = new Blob([buffer],{type:"video/mp4"});
  resultName = selected.name.replace(/\.[^.]+$/i,"")+"_dystore_v10.02_h264_4k60.mp4";
  setp(100,"H.264 4K60 complete ✓");
}

async function preserve(){
  setp(20,"Reading source…");
  const input2 = new Input({formats:ALL_FORMATS,source:new BlobSource(selected)});
  const out2 = new Output({
    format:new Mp4OutputFormat({fastStart:"in-memory"}),
    target:new BufferTarget()
  });
  const conversion = await Conversion.init({
    input:input2, output:out2, tracks:"primary", tags:{}
  });
  if(!conversion.isValid) throw Error("Source cannot be packaged as MP4.");
  conversion.onProgress=p=>setp(20+Math.round(p*80),"Preserving source…");
  await conversion.execute();
  result=new Blob([out2.target.buffer],{type:"video/mp4"});
  resultName=selected.name.replace(/\.[^.]+$/i,"")+"_dystore_v10.02_preserve.mp4";
  setp(100,"Preserve complete ✓");
}

async function inspect(blob, mode){
  const url=URL.createObjectURL(blob), v=document.createElement("video");
  v.preload="metadata"; v.src=url;
  const m=await new Promise(resolve=>{
    v.onloadedmetadata=()=>resolve({w:v.videoWidth,h:v.videoHeight,d:v.duration});
    v.onerror=()=>resolve({w:0,h:0,d:0});
  });
  URL.revokeObjectURL(url);
  const avg=m.d?blob.size*8/m.d:0;
  $("#res").textContent=m.w&&m.h?`${m.w} × ${m.h}`:"—";
  $("#fps").textContent=mode==="client"?"60 FPS":"Source preserved";
  $("#bitrate").textContent=avg?(avg/1e6).toFixed(2)+" Mbps":"—";
  $("#size").textContent=fmt(blob.size);
  $("#codec").textContent=mode==="client"?"H.264 / AVC":"Source";
  $("#profile").textContent=mode==="client"?"High · Level 5.2":"Preserve";
  $("#notice").textContent=mode==="client"
    ?"Measured from the generated MP4. Encoder was requested with hardwareAcceleration=prefer-hardware; the browser decides whether hardware is actually used."
    :"Source/container preserved locally; no forced video re-encode.";
}

processBtn.onclick=async()=>{
  if(!selected)return;
  processBtn.disabled=true; downloadBtn.hidden=true;
  try{
    const mode=document.querySelector('input[name="mode"]:checked').value;
    if(mode==="client") await processClient(); else await preserve();
    await inspect(result,mode);
    downloadBtn.hidden=false; processBtn.disabled=false; processBtn.textContent="PROCESS AGAIN";
  }catch(e){
    console.error(e);
    setp(0,"Processing failed");
    alert(e?.message||"Processing failed");
    processBtn.disabled=false; processBtn.textContent="TRY AGAIN";
  }
};

downloadBtn.onclick=()=>{
  if(!result)return;
  const u=URL.createObjectURL(result), a=document.createElement("a");
  a.href=u; a.download=resultName; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};

checkEncoder().catch(()=>{});
