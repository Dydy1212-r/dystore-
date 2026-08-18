// DYSTORE v4 — Original Quality / Fast Patch
// Video bytes stay on the device. No re-encoding is used.
// The patch changes MP4 container/sample-table data only.

const CDN = "https://cdn.jsdelivr.net/gh/irgifebry/NoBlur@main/src/";
const $ = (s) => document.querySelector(s);

const fileInput = $("#file");
const drop = $("#drop");
const fileName = $("#fileName");
const processBtn = $("#process");
const downloadBtn = $("#download");
const statusEl = $("#status");
const percentEl = $("#percent");
const bar = $("#bar");
const queue = $("#queue");
const toast = $("#toast");

let selected = null;
let resultBlob = null;
let resultName = "";

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(window._toast);
  window._toast = setTimeout(() => toast.classList.remove("show"), 3200);
}

function setProgress(n, msg) {
  n = Math.max(0, Math.min(100, n));
  bar.style.width = n + "%";
  percentEl.textContent = n + "%";
  statusEl.textContent = msg;
}

function fmt(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}

function inspect(file) {
  const v = document.createElement("video");
  v.preload = "metadata";
  v.muted = true;
  v.playsInline = true;
  const url = URL.createObjectURL(file);
  v.onloadedmetadata = () => {
    $("#resolution").textContent = v.videoWidth + " × " + v.videoHeight;
    $("#duration").textContent = Number.isFinite(v.duration) ? Number(v.duration).toFixed(2) + "s" : "—";
    $("#size").textContent = fmt(file.size);
    $("#format").textContent = file.type || "video/mp4";
    URL.revokeObjectURL(url);
  };
  v.src = url;
}

function choose(file) {
  if (!file) return;
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name);
  if (!isVideo) return toastMsg("សូមជ្រើសរើស MP4 ឬ MOV");

  selected = file;
  resultBlob = null;
  downloadBtn.hidden = true;
  processBtn.disabled = false;
  processBtn.textContent = "PROCESS VIDEO";
  fileName.textContent = "✓ " + file.name + " · " + fmt(file.size);
  fileName.style.color = "#24d9ff";
  queue.classList.add("show");
  queue.textContent = "Ready: " + file.name;
  inspect(file);
  $("#outType").textContent = "Original quality / patched container";
  setProgress(0, "Ready to process");
}

fileInput.addEventListener("change", (e) => choose(e.target.files[0]));
drop.addEventListener("click", () => fileInput.click());
["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (e) => {
  e.preventDefault();
  drop.classList.add("drag");
}));
["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
}));
drop.addEventListener("drop", (e) => choose(e.dataTransfer.files[0]));

async function fastPatch() {
  setProgress(8, "Loading patch engine…");

  const { normalizeContainer } = await import(CDN + "mp4-normalize.mjs");
  const { inflateSampleTableVideo } = await import(CDN + "mp4-inflate.mjs");

  setProgress(25, "Reading video locally…");
  const buffer = await selected.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  setProgress(45, "Normalizing MP4 container…");
  const normalized = normalizeContainer(bytes, view);
  if (!normalized?.valid) throw new Error("Invalid or unsupported MP4 container.");

  setProgress(65, "Applying original-quality patch…");
  const inflated = inflateSampleTableVideo(
    normalized.newBytes,
    normalized.newView,
    10
  );

  setProgress(90, "Preparing original-quality result…");
  return new Blob([inflated.newBuffer], { type: "video/mp4" });
}

async function processVideo() {
  if (!selected) return;
  processBtn.disabled = true;
  downloadBtn.hidden = true;

  try {
    resultBlob = await fastPatch();
    const base = selected.name.replace(/\.[^.]+$/, "");
    resultName = base + "_dystore.mp4";

    $("#outType").textContent = "Original quality · Fast Patch";
    setProgress(100, "Processing complete ✓");
    downloadBtn.hidden = false;
    processBtn.textContent = "PROCESS AGAIN";

    addHistory(selected.name, resultName, resultBlob.size);
    toastMsg("ជោគជ័យ! Original Quality video រួចរាល់");
  } catch (err) {
    console.error(err);
    setProgress(0, "Processing failed");
    processBtn.disabled = false;
    processBtn.textContent = "TRY AGAIN";
    toastMsg("Process failed: " + (err?.message || "Unknown error"));
  }
}

processBtn.addEventListener("click", processVideo);

downloadBtn.addEventListener("click", () => {
  if (!resultBlob) return;
  const url = URL.createObjectURL(resultBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = resultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});

function addHistory(input, output, size) {
  const box = $("#historyList");
  if (box.classList.contains("empty")) {
    box.classList.remove("empty");
    box.innerHTML = "";
  }
  const row = document.createElement("div");
  row.className = "historyRow";
  row.innerHTML = `<span>✓ ${input} → ${output}</span><span>${fmt(size)}</span>`;
  box.prepend(row);
}

$("#userBtn").addEventListener("click", () => toastMsg("dystore · ORIGINAL QUALITY"));
