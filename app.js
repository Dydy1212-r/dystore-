import {
  Input, Output, Conversion, ALL_FORMATS, BlobSource,
  BufferTarget, Mp4OutputFormat, Quality
} from "https://cdn.jsdelivr.net/npm/mediabunny/+esm";

const $ = s => document.querySelector(s);

let file = null;
let result = null;
let resultName = "";

const W = 1920;
const H = 1080;
const FPS = 60;
const BR = 16_000_000;
const CODEC = "avc1.64002A";

function size(n) {
  if (!n) return "—";
  if (n > 1e9) return (n / 1e9).toFixed(2) + " GB";
  if (n > 1e6) return (n / 1e6).toFixed(2) + " MB";
  return (n / 1024).toFixed(1) + " KB";
}

function progress(p, t) {
  $("#bar").style.width = Math.max(0, Math.min(100, p)) + "%";
  $("#pct").textContent = Math.round(p) + "%";
  $("#status").textContent = t;
}

$("#drop").onclick = () => $("#file").click();

$("#file").onchange = e => {
  const f = e.target.files?.[0];
  if (!f) return;

  if (!f.type.startsWith("video/") && !/\.(mp4|mov)$/i.test(f.name)) {
    return alert("Please choose an MP4 or MOV video.");
  }

  file = f;
  $("#name").textContent = "✓ " + f.name + " · " + size(f.size);
  $("#process").disabled = false;
  $("#process").textContent = "PROCESS 1080P60 H.264";
  progress(0, "Ready");
};

async function detectEncoder() {
  if (!("VideoEncoder" in window)) {
    $("#engine").textContent =
      "✓ Browser encoder API unavailable · MediaBunny software fallback";
    $("#engine").className = "engine ok";
    return "software";
  }

  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: CODEC,
      width: W,
      height: H,
      bitrate: BR,
      framerate: FPS,
      bitrateMode: "constant",
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "quality"
    });

    if (r?.supported) {
      $("#engine").textContent =
        "✓ H.264 1080p60 supported · hardware-first";
      $("#engine").className = "engine ok";
      return "hardware-first";
    }
  } catch (e) {
    console.warn("Encoder check:", e);
  }

  $("#engine").textContent =
    "⚠ 1080p60 hardware encoder not reported · software fallback";
  $("#engine").className = "engine warn";
  return "software";
}

detectEncoder();

async function encode() {
  progress(2, "Preparing local video…");

  const mode = await detectEncoder();

  progress(6, "Opening video locally…");

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file)
  });

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget()
  });

  const conversion = await Conversion.init({
    input,
    output,
    tracks: "primary",

    video: {
      width: W,
      height: H,
      fit: "fill",
      frameRate: FPS,
      codec: "avc",
      quality: new Quality({
        bitrate: BR,
        bitrateMode: "constant"
      }),
      keyFrameInterval: 2,
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "quality",
      fullCodecString: CODEC,
      forceTranscode: true
    },

    audio: {
      codec: "aac",
      bitrate: 192000,
      sampleRate: 48000
    },

    tags: {}
  });

  if (!conversion.isValid) {
    throw Error("Local conversion pipeline rejected this source.");
  }

  conversion.onProgress = p => {
    progress(
      8 + Math.round(p * 90),
      mode === "hardware-first"
        ? "Encoding locally · H.264 1080p60…"
        : "Encoding locally · software H.264 1080p60…"
    );
  };

  await conversion.execute();

  if (!output.target.buffer) {
    throw Error("No MP4 output was produced.");
  }

  result = new Blob([output.target.buffer], { type: "video/mp4" });

  resultName =
    file.name.replace(/\.[^.]+$/i, "") +
    "_dystore_v10.05_1080p60.mp4";

  progress(100, "Complete ✓");
}

async function inspect(blob) {
  const u = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.preload = "metadata";
  v.src = u;

  const m = await new Promise(resolve => {
    v.onloadedmetadata = () =>
      resolve([v.videoWidth, v.videoHeight, v.duration]);
    v.onerror = () => resolve([0, 0, 0]);
  });

  URL.revokeObjectURL(u);

  $("#res").textContent = m[0] ? m[0] + " × " + m[1] : "—";
  $("#fps").textContent = "60 FPS target";
  $("#bitrate").textContent =
    m[2] ? (blob.size * 8 / m[2] / 1e6).toFixed(2) + " Mbps" : "—";
  $("#size").textContent = size(blob.size);
  $("#codec").textContent = "H.264 / AVC";
  $("#profile").textContent = "Client · HW-first / SW fallback";
  $("#notice").textContent =
    "Output target: 1920×1080 · 60 FPS · H.264 · MP4. Processing stays on the device.";
}

$("#process").onclick = async () => {
  if (!file) return;

  $("#process").disabled = true;
  $("#download").hidden = true;

  try {
    await encode();
    await inspect(result);

    $("#download").hidden = false;
    $("#process").disabled = false;
    $("#process").textContent = "PROCESS AGAIN";
  } catch (e) {
    console.error(e);
    progress(0, "Processing failed");
    alert(e?.message || "Processing failed");
    $("#process").disabled = false;
    $("#process").textContent = "TRY AGAIN";
  }
};

$("#download").onclick = () => {
  if (!result) return;

  const u = URL.createObjectURL(result);
  const a = document.createElement("a");
  a.href = u;
  a.download = resultName;
  a.click();

  setTimeout(() => URL.revokeObjectURL(u), 1500);
};
