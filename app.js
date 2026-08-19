import {Input,Output,Conversion,ALL_FORMATS,BlobSource,BufferTarget,Mp4OutputFormat,Quality} from "https://cdn.jsdelivr.net/npm/mediabunny/+esm";

const $=s=>document.querySelector(s);
let file=null,result=null,resultName="";
const TARGET={width:3840,height:2160,fps:60,bitrate:57300000,codec:"avc1.640034"};
let selected=null;

function size(n){
  if(!n)return"—";
  if(n>1e9)return(n/1e9).toFixed(2)+" GB";
  if(n>1e6)return(n/1e6).toFixed(2)+" MB";
  return(n/1024).toFixed(1)+" KB";
}
function progress(p,t){
  $("#bar").style.width=p+"%";
  $("#pct").textContent=p+"%";
  $("#status").textContent=t;
}
function setEngine(text,cls="warn"){
  $("#engine").textContent=text;
  $("#engine").className="engine "+cls;
}

const candidates=[
  {width:3840,height:2160,fps:60,bitrate:57300000,codec:"avc1.640034",label:"4K60",accel:"prefer-hardware"},
  {width:3840,height:2160,fps:60,bitrate:57300000,codec:"avc1.640034",label:"4K60",accel:"prefer-software"},
  {width:3840,height:2160,fps:30,bitrate:30000000,codec:"avc1.640034",label:"4K30",accel:"prefer-hardware"},
  {width:3840,height:2160,fps:30,bitrate:30000000,codec:"avc1.640034",label:"4K30",accel:"prefer-software"},
  {width:1920,height:1080,fps:60,bitrate:12000000,codec:"avc1.4D0034",label:"1080p60",accel:"prefer-hardware"},
  {width:1920,height:1080,fps:60,bitrate:12000000,codec:"avc1.4D0034",label:"1080p60",accel:"prefer-software"}
];

async function findEncoder(){
  if(!("VideoEncoder" in window)){
    setEngine("⚠ WebCodecs VideoEncoder unavailable · using fallback check","warn");
    return null;
  }
  for(const c of candidates){
    try{
      const r=await VideoEncoder.isConfigSupported({
        codec:c.codec,width:c.width,height:c.height,
        bitrate:c.bitrate,framerate:c.fps,
        bitrateMode:"constant",
        hardwareAcceleration:c.accel,
        latencyMode:"quality"
      });
      if(r?.supported)return c;
    }catch(e){console.warn("Encoder check failed",c,e)}
  }
  return null;
}

async function detect(){
  const c=await findEncoder();
  selected=c;
  if(c){
    const mode=c.accel==="prefer-hardware"?"hardware-first":"software fallback";
    setEngine(`✓ ${c.label} available · ${mode}`,"ok");
    $("#process").textContent=`PROCESS ${c.label} H.264`;
    return true;
  }
  setEngine("⚠ H.264 WebCodecs encoder unavailable on this browser","warn");
  return false;
}

$("#drop").onclick=()=>$("#file").click();
$("#file").onchange=async e=>{
  const f=e.target.files?.[0];
  if(!f)return;
  if(!f.type.startsWith("video/")&&!/\.(mp4|mov)$/i.test(f.name))
    return alert("Please choose an MP4 or MOV video.");
  file=f;
  $("#name").textContent="✓ "+f.name+" · "+size(f.size);
  $("#process").disabled=false;
  progress(0,"Checking Android encoder…");
  await detect();
  progress(0,"Ready");
};

detect();

async function encode(){
  progress(3,"Checking Android encoder…");
  const ok=await detect();
  if(!ok)throw Error("H.264 encoding is unavailable in this browser/device. Try the latest Chrome on Android.");
  const c=selected;
  progress(6,`Opening video locally · ${c.label}…`);

  const input=new Input({
    formats:ALL_FORMATS,
    source:new BlobSource(file)
  });
  const output=new Output({
    format:new Mp4OutputFormat({fastStart:"in-memory"}),
    target:new BufferTarget()
  });

  const conversion=await Conversion.init({
    input,output,tracks:"primary",
    video:{
      width:c.width,
      height:c.height,
      fit:"fill",
      frameRate:c.fps,
      codec:"avc",
      quality:new Quality({bitrate:c.bitrate,bitrateMode:"constant"}),
      keyFrameInterval:2,
      hardwareAcceleration:c.accel,
      latencyMode:"quality",
      fullCodecString:c.codec,
      forceTranscode:true
    },
    audio:{
      codec:"aac",
      bitrate:192000,
      sampleRate:48000
    },
    tags:{}
  });

  if(!conversion.isValid)
    throw Error("Local conversion pipeline rejected this source.");

  conversion.onProgress=p=>
    progress(8+Math.round(p*90),`Encoding locally · H.264 ${c.label}…`);

  await conversion.execute();

  if(!output.target.buffer)
    throw Error("No MP4 output was produced.");

  result=new Blob([output.target.buffer],{type:"video/mp4"});
  resultName=file.name.replace(/\.[^.]+$/i,"")+
    `_dystore_v10.04_${c.label.toLowerCase().replace("p","p")}.mp4`;

  progress(100,`Complete ✓ · ${c.label}`);
}

async function inspect(blob){
  const u=URL.createObjectURL(blob);
  const v=document.createElement("video");
  v.preload="metadata";
  v.src=u;

  const m=await new Promise(r=>{
    v.onloadedmetadata=()=>r([v.videoWidth,v.videoHeight,v.duration]);
    v.onerror=()=>r([0,0,0]);
  });

  URL.revokeObjectURL(u);
  $("#res").textContent=m[0]?m[0]+" × "+m[1]:"—";
  $("#fps").textContent=selected?selected.fps+" FPS":"—";
  $("#bitrate").textContent=m[2]?(blob.size*8/m[2]/1e6).toFixed(2)+" Mbps":"—";
  $("#size").textContent=size(blob.size);
  $("#codec").textContent="H.264 / AVC";
  $("#profile").textContent=selected?
    `${selected.label} · ${selected.accel==="prefer-hardware"?"HW-first":"SW fallback"}`:"—";
  $("#notice").textContent=
    `Generated locally. Target selected automatically: ${selected?.label||"H.264"} · ${selected?.fps||"—"} FPS.`;
}

$("#process").onclick=async()=>{
  if(!file)return;
  $("#process").disabled=true;
  $("#download").hidden=true;
  try{
    await encode();
    await inspect(result);
    $("#download").hidden=false;
    $("#process").disabled=false;
    $("#process").textContent="PROCESS AGAIN";
  }catch(e){
    console.error(e);
    progress(0,"Processing failed");
    alert(e?.message||"Processing failed");
    $("#process").disabled=false;
    $("#process").textContent="TRY AGAIN";
  }
};

$("#download").onclick=()=>{
  if(!result)return;
  const u=URL.createObjectURL(result);
  const a=document.createElement("a");
  a.href=u;
  a.download=resultName;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};
