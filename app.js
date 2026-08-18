const NO_BLUR_CDN =
  "https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/";

const $ = (selector) => document.querySelector(selector);

const fileInput = $("#file");
const drop = $("#drop");
const fileName = $("#fileName");
const processBtn = $("#process");
const downloadBtn = $("#download");
const queue = $("#queue");
const statusEl = $("#status");
const percentEl = $("#percent");
const bar = $("#bar");
const toast = $("#toast");

let selectedFile = null;
let resultBlob = null;
let resultName = "";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(
    () => toast.classList.remove("show"),
    3200
  );
}

function setProgress(percent, message) {
  const value = Math.max(0, Math.min(100, percent));
  bar.style.width = `${value}%`;
  percentEl.textContent = `${value}%`;
  statusEl.textContent = message;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatBitrate(bitsPerSecond) {
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) return "—";
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps`;
  }
  return `${(bitsPerSecond / 1_000).toFixed(0)} Kbps`;
}

function setOutputEmpty() {
  $("#outResolution").textContent = "—";
  $("#outFPS").textContent = "—";
  $("#outBitrate").textContent = "—";
  $("#outFileSize").textContent = "—";
  $("#outFormat").textContent = "—";
  $("#outMethod").textContent = "—";

  $("#outCodec").textContent = "—";
  $("#outDuration").textContent = "—";
  $("#outAudio").textContent = "—";
  $("#outSamples").textContent = "—";
  $("#outContainer").textContent = "MP4";
  $("#outIntegrity").textContent = "—";

  $("#outputNotice").textContent =
    "Process a video to inspect the actual output.";
}

function inspectVideoElement(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const data = {
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0
      };

      URL.revokeObjectURL(url);
      resolve(data);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: 0,
        height: 0,
        duration: 0
      });
    };

    video.src = url;
  });
}

/*
  Read the actual OUTPUT MP4 with MP4Box.
  This is intentionally run on resultBlob, never selectedFile.
*/
async function inspectRealOutput(blob) {
  const videoElement = await inspectVideoElement(blob);

  let mp4Info = null;

  try {
    if (typeof MP4Box !== "undefined") {
      mp4Info = await new Promise((resolve) => {
        const mp4file = MP4Box.createFile();
        let finished = false;

        const done = (value) => {
          if (finished) return;
          finished = true;
          resolve(value);
        };

        mp4file.onError = () => done(null);

        mp4file.onReady = (info) => {
          const videoTracks = Array.isArray(info.videoTracks)
            ? info.videoTracks
            : [];

          const audioTracks = Array.isArray(info.audioTracks)
            ? info.audioTracks
            : [];

          const track = videoTracks[0] || null;

          if (!track) {
            done({
              codec: "Unknown",
              audio: audioTracks.length ? "Present" : "None",
              fps: 0,
              samples: 0,
              bitrate: 0,
              width: videoElement.width,
              height: videoElement.height,
              duration: videoElement.duration
            });
            return;
          }

          const durationSeconds =
            track.track_duration && track.timescale
              ? track.track_duration / track.timescale
              : track.movie_duration && track.movie_timescale
                ? track.movie_duration / track.movie_timescale
                : videoElement.duration;

          const sampleCount =
            Number(track.nb_samples) ||
            Number(track.nb_samples_per_chunk) ||
            0;

          const fps =
            sampleCount > 0 && durationSeconds > 0
              ? sampleCount / durationSeconds
              : 0;

          const trackBitrate = Number(track.bitrate) || 0;

          done({
            codec: track.codec || "Unknown",
            audio: audioTracks.length ? "Present" : "None",
            fps,
            samples: sampleCount,
            bitrate: trackBitrate,
            width: Number(track.video?.width) || videoElement.width,
            height: Number(track.video?.height) || videoElement.height,
            duration: durationSeconds || videoElement.duration
          });
        };

        mp4file.onSegment = () => {};

        blob.arrayBuffer().then((buffer) => {
          buffer.fileStart = 0;
          mp4file.appendBuffer(buffer);
          mp4file.flush();

          setTimeout(() => done(null), 5000);
        }).catch(() => done(null));
      });
    }
  } catch (error) {
    console.warn("MP4Box inspection failed:", error);
  }

  /*
    IMPORTANT:
    If MP4Box cannot expose a video bitrate, we use the real
    output file size / real output duration as an AVERAGE FILE
    BITRATE. We do NOT copy the input bitrate.
  */
  const duration =
    Number(mp4Info?.duration) > 0
      ? Number(mp4Info.duration)
      : videoElement.duration;

  const averageOutputBitrate =
    duration > 0
      ? (blob.size * 8) / duration
      : 0;

  const bitrate =
    Number(mp4Info?.bitrate) > 0
      ? Number(mp4Info.bitrate)
      : averageOutputBitrate;

  return {
    width: Number(mp4Info?.width) || videoElement.width || 0,
    height: Number(mp4Info?.height) || videoElement.height || 0,
    fps: Number(mp4Info?.fps) || 0,
    bitrate,
    averageBitrate: averageOutputBitrate,
    size: blob.size,
    format: blob.type || "video/mp4",
    codec: mp4Info?.codec || "Unknown",
    audio: mp4Info?.audio || "Unknown",
    samples: Number(mp4Info?.samples) || 0,
    duration
  };
}

function showRealOutput(meta) {
  $("#outResolution").textContent =
    meta.width && meta.height
      ? `${meta.width} × ${meta.height}`
      : "Unknown";

  $("#outFPS").textContent =
    meta.fps > 0
      ? `${meta.fps.toFixed(2)} FPS`
      : "Not available";

  $("#outBitrate").textContent =
    formatBitrate(meta.bitrate);

  $("#outFileSize").textContent =
    formatBytes(meta.size);

  $("#outFormat").textContent =
    meta.format;

  $("#outMethod").textContent =
    "No re-encode";

  $("#outCodec").textContent =
    meta.codec;

  $("#outDuration").textContent =
    meta.duration > 0
      ? `${meta.duration.toFixed(2)} s`
      : "—";

  $("#outAudio").textContent =
    meta.audio;

  $("#outSamples").textContent =
    meta.samples > 0
      ? meta.samples.toLocaleString()
      : "—";

  $("#outContainer").textContent = "MP4";
  $("#outIntegrity").textContent = "Readable";

  $("#outputNotice").textContent =
    `Measured from the processed output file: ${formatBytes(meta.size)}. ` +
    `Bitrate is never copied from the original.`;

  /*
    If the file-size/duration calculation is being used as fallback,
    make that explicit so the UI does not pretend it is the codec
    video-track bitrate.
  */
  const bitrateNote = $("#bitrateNote");
  if (Number(meta.bitrate) === Number(meta.averageBitrate)) {
    bitrateNote.textContent = "Actual output average";
  } else {
    bitrateNote.textContent = "Actual video track";
  }
}

async function inspectSelectedForPreview(file) {
  const info = await inspectVideoElement(file);

  $("#outResolution").textContent =
    info.width && info.height
      ? `${info.width} × ${info.height}`
      : "—";

  $("#outFPS").textContent = "—";
  $("#outBitrate").textContent = "—";
  $("#outFileSize").textContent = "—";
  $("#outFormat").textContent = "—";
  $("#outMethod").textContent = "—";
}

function chooseFile(file) {
  if (!file) return;

  const validExtension = /\.(mp4|mov)$/i.test(file.name);
  const validType =
    file.type === "video/mp4" ||
    file.type === "video/quicktime" ||
    file.type.startsWith("video/");

  if (!validExtension && !validType) {
    showToast("សូមជ្រើសរើស MP4 ឬ MOV");
    return;
  }

  selectedFile = file;
  resultBlob = null;
  resultName = "";

  downloadBtn.hidden = true;
  processBtn.disabled = false;
  processBtn.textContent = "PROCESS VIDEO";

  fileName.textContent =
    `✓ ${file.name} · ${formatBytes(file.size)}`;
  fileName.style.color = "#24d9ff";

  queue.classList.add("show");
  queue.textContent =
    `Queued: ${file.name} · ${formatBytes(file.size)}`;

  setProgress(0, "Ready to process");
  inspectSelectedForPreview(file);

  document.querySelector("#output").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

fileInput.addEventListener("change", (event) => {
  chooseFile(event.target.files?.[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    drop.classList.add("drag");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    drop.classList.remove("drag");
  });
});

drop.addEventListener("drop", (event) => {
  chooseFile(event.dataTransfer.files?.[0]);
});

async function processWithoutReencode() {
  if (!selectedFile) return;

  processBtn.disabled = true;
  downloadBtn.hidden = true;
  setProgress(5, "Reading original MP4…");

  try {
    /*
      V6 deliberately does NOT call inflateSampleTableVideo().
      The previous 10× inflation was the reason a 60 FPS source
      could be interpreted as 600 FPS by some players.
    */
    const { normalizeContainer } =
      await import(NO_BLUR_CDN + "mp4-normalize.mjs");

    const inputBuffer = await selectedFile.arrayBuffer();
    const inputBytes = new Uint8Array(inputBuffer);
    const inputView = new DataView(inputBuffer);

    setProgress(25, "Normalizing MP4 container…");

    const normalized =
      normalizeContainer(inputBytes, inputView);

    if (!normalized || !normalized.valid) {
      throw new Error(
        "The MP4 container could not be normalized."
      );
    }

    setProgress(65, "Building output without re-encoding…");

    const outputBuffer = normalized.newBuffer;

    if (!outputBuffer || outputBuffer.byteLength < 100) {
      throw new Error("The processed output is empty.");
    }

    resultBlob = new Blob(
      [outputBuffer],
      { type: "video/mp4" }
    );

    const baseName =
      selectedFile.name.replace(/\.[^.]+$/i, "");

    resultName =
      `${baseName}_dystore.mp4`;

    setProgress(82, "Reading actual output metadata…");

    /*
      IMPORTANT:
      This reads resultBlob, NOT selectedFile.
    */
    const outputMeta =
      await inspectRealOutput(resultBlob);

    setProgress(100, "Processing complete ✓");

    showRealOutput(outputMeta);

    downloadBtn.hidden = false;
    processBtn.disabled = false;
    processBtn.textContent = "PROCESS AGAIN";

    addHistory(
      selectedFile.name,
      resultName,
      outputMeta
    );

    showToast(
      `ជោគជ័យ · ${outputMeta.width}×${outputMeta.height} · ` +
      `${outputMeta.fps > 0 ? outputMeta.fps.toFixed(2) : "?"} FPS`
    );

  } catch (error) {
    console.error(error);

    setProgress(
      0,
      "Processing failed"
    );

    processBtn.disabled = false;
    processBtn.textContent = "TRY AGAIN";

    showToast(
      `Process failed: ${error?.message || "Unknown error"}`
    );
  }
}

processBtn.addEventListener(
  "click",
  processWithoutReencode
);

downloadBtn.addEventListener("click", () => {
  if (!resultBlob) return;

  const url =
    URL.createObjectURL(resultBlob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = resultName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1500
  );

  showToast("Download started");
});

function addHistory(input, output, meta) {
  const box = $("#historyList");

  if (box.classList.contains("empty")) {
    box.classList.remove("empty");
    box.innerHTML = "";
  }

  const row =
    document.createElement("div");

  row.className = "historyRow";

  row.innerHTML = `
    <span>✓ ${input} → ${output}</span>
    <span>${formatBytes(meta.size)}</span>
  `;

  box.prepend(row);
}

$("#userBtn").addEventListener(
  "click",
  () => showToast("dystore · FREE account")
);

setOutputEmpty();
