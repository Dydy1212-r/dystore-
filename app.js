const $=s=>document.querySelector(s);
let file=null,result=null,resultName="";
const input=$("#file"),drop=$("#drop"),btn=$("#process"),dl=$("#download");
function fmt(n){if(!n)return"—";if(n>1e9)return(n/1e9).toFixed(2)+" GB";if(n>1e6)return(n/1e6).toFixed(2)+" MB";return(n/1024).toFixed(1)+" KB"}
function mbps(n){return n?((n/1e6).toFixed(2)+" Mbps"):"—"}
function setp(n,t){$("#bar").style.width=n+"%";$("#pct").textContent=n+"%";$("#status").textContent=t}
function choose(f){if(!f)return;if(!f.type.startsWith("video/")&&!/\.(mp4|mov)$/i.test(f.name))return alert("MP4/MOV only");file=f;$("#name").textContent="✓ "+f.name+" · "+fmt(f.size);btn.disabled=false;btn.textContent="PROCESS VIDEO";setp(0,"Ready")}
input.onchange=e=>choose(e.target.files[0]);drop.onclick=()=>input.click();
async function meta(blob){
 const u=URL.createObjectURL(blob),v=document.createElement("video");v.preload="metadata";v.src=u;
 const m=await new Promise(r=>{v.onloadedmetadata=()=>r({w:v.videoWidth,h:v.videoHeight,d:v.duration});v.onerror=()=>r({w:0,h:0,d:0})});URL.revokeObjectURL(u);
 return {...m,size:blob.size,avg:m.d?blob.size*8/m.d:0};
}
function show(m,method){
 $("#res").textContent=m.w&&m.h?m.w+" × "+m.h:"—";$("#fps").textContent=m.d?m.fps?m.fps.toFixed(2)+" FPS":"Source FPS preserved":"—";
 $("#bitrate").textContent=mbps(m.avg);$("#size").textContent=fmt(m.size);$("#format").textContent="video/mp4";$("#method").textContent=method;
 $("#notice").textContent="Bitrate shown here is calculated from the actual output file size and duration; it is not copied from the original.";
}
async function preserve(){
 setp(15,"Loading source…");
 const {normalizeContainer}=await import("https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/mp4-normalize.mjs");
 setp(45,"Normalizing MP4 container…");
 const ab=await file.arrayBuffer(),u=new Uint8Array(ab),out=normalizeContainer(u,new DataView(ab));
 if(!out?.valid||!out.newBuffer)throw Error("MP4 normalization failed");
 setp(75,"Checking actual output…");result=new Blob([out.newBuffer],{type:"video/mp4"});resultName=file.name.replace(/\.[^.]+$/i,"")+"_dystore_v10.mp4";
 const m=await meta(result);m.fps=null;show(m,"No re-encode");setp(100,"Complete ✓");
}
async function hevc(){
 if(!("VideoEncoder" in window))throw Error("This browser has no WebCodecs encoder. Use Preserve Source or a browser/device with HEVC WebCodecs support.");
 const cfgs=[
 {codec:"hvc1.1.6.L153.B0",width:3840,height:2160,bitrate:60000000,framerate:60},
 {codec:"hev1.1.6.L153.B0",width:3840,height:2160,bitrate:60000000,framerate:60}
 ];
 let ok=null;for(const c of cfgs){try{const x=await VideoEncoder.isConfigSupported(c);if(x.supported){ok=c;break}}catch{}}
 if(!ok)throw Error("HEVC encoder is not supported by this browser. V10 will not fake HEVC.");
 throw Error("A real HEVC encoder is available, but V10 browser muxing is not enabled yet. Use Preserve Source until the HEVC MP4 muxer is added.");
}
btn.onclick=async()=>{if(!file)return;btn.disabled=true;dl.hidden=true;try{const mode=document.querySelector('input[name=mode]:checked').value;if(mode==="preserve")await preserve();else{setp(10,"Checking real HEVC encoder…");await hevc()}dl.hidden=false;btn.disabled=false;btn.textContent="PROCESS AGAIN"}catch(e){setp(0,"Processing failed");alert(e.message);btn.disabled=false;btn.textContent="TRY AGAIN"}};
dl.onclick=()=>{if(!result)return;const u=URL.createObjectURL(result),a=document.createElement("a");a.href=u;a.download=resultName;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
