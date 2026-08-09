// ---- 下载核心逻辑（UI 无关，状态为响应式，供 DownloadButton.vue 使用） ----

import { reactive } from "vue";
import { usePlayerStore } from "../store";

// ---- Icon ----
export const downloadIcon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
)}`;

// ---- 类型 ----

const MAX_CONCURRENT = 10;

type DownloadStatus =
  | "idle"
  | "preparing"
  | "downloading"
  | "paused"
  | "done"
  | "error";

interface DownloadState {
  status: DownloadStatus;
  urls: string[];
  chunks: (ArrayBuffer | null)[];
  downloadedBytes: number;
  completedCount: number; // 已下载完成的片段数
  speed: number; // bytes/s
  error: string;
  fileName: string;
}

// ---- 状态（响应式） ----

export const downloadState: DownloadState = reactive({
  status: "idle",
  urls: [],
  chunks: [],
  downloadedBytes: 0,
  completedCount: 0,
  speed: 0,
  error: "",
  fileName: "video.ts",
});

let activeControllers = new Set<AbortController>();
let nextIndex = 0; // 下一个要分配的片段索引（worker 原子消费）
let speedSamples: { time: number; bytes: number }[] = [];
export const fragTimestamps: number[] = []; // 每个片段完成的时间戳，用于 ETA 滑动窗口
let loopId = 0; // rAF loop id
let activeCount = 0;
let encryptKey: CryptoKey | null = null; // AES 密钥（Web Crypto 格式）
let encryptKeyBytes: Uint8Array | null = null; // 原始密钥字节
let encryptMethod = ""; // "AES-128" 或 "NONE"
let ivForFrag: ((sn: number) => Uint8Array) | null = null; // 每个片段的 IV 生成函数

// ---- 工具函数 ----

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1) return "";
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "";
  const s = Math.ceil(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} 小时`);
  if (m > 0) parts.push(`${m} 分`);
  parts.push(`${sec} 秒`);
  return `剩余 ${parts.join(" ")}`;
}

function getFragmentUrls(): string[] {
  const { hls } = usePlayerStore();
  if (!hls) return [];

  const levelIndex = hls.currentLevel === -1 ? 0 : hls.currentLevel;
  const level = hls.levels[levelIndex];
  if (!level?.details?.fragments?.length) return [];

  const detailsUrl = level.details.url;
  return level.details.fragments
    .map((frag) => {
      return (
        frag.url ||
        (frag.relurl
          ? (detailsUrl || usePlayerStore().currentSource || "").replace(
              /\/[^/]*$/,
              "/",
            ) + frag.relurl
          : "")
      );
    })
    .filter(Boolean);
}

// ---- 核心下载逻辑 ----

export function prepareDownload() {
  const { currentSource, hls } = usePlayerStore();
  if (!currentSource || !hls) return;

  downloadState.status = "preparing";
  downloadState.urls = getFragmentUrls();
  downloadState.chunks = new Array(downloadState.urls.length).fill(null);
  downloadState.downloadedBytes = 0;
  downloadState.completedCount = 0;
  downloadState.speed = 0;
  downloadState.error = "";
  speedSamples = [];
  fragTimestamps.length = 0;
  nextIndex = 0;
  activeCount = 0;
  encryptKey = null;
  encryptMethod = "";

  const titleEl = document.getElementById("video_title");
  const title = titleEl?.innerText?.trim();
  const episodeEl = document.querySelector(
    '#lineContent .line-res [name="lineData"].active',
  );
  const episode = episodeEl?.textContent?.trim();
  let baseName =
    title ||
    currentSource
      ?.split("/")
      .pop()
      ?.replace(/\.m3u8.*$/i, "") ||
    "video";
  if (episode) baseName = `${baseName} - ${episode}`;
  downloadState.fileName = `${baseName}.ts`;

  if (downloadState.urls.length === 0) {
    downloadState.status = "error";
    downloadState.error = "没有可用的视频片段";
    return;
  }

  // 检测加密
  try {
    const levelIndex = hls.currentLevel === -1 ? 0 : hls.currentLevel;
    const level = hls.levels[levelIndex];
    const frag = level?.details?.fragments?.[0];
    const dd = frag?.decryptdata;
    if (dd?.encrypted && dd.method === "AES-128") {
      encryptMethod = "AES-128";
      initEncryption(dd, level!.details!.fragments);
    }
  } catch {
    // 忽略检测异常
  }

  downloadState.status = "downloading";
}

async function initEncryption(dd: any, fragments: any[]) {
  // 获取密钥字节
  if (dd.key instanceof Uint8Array && dd.key.length === 16) {
    encryptKeyBytes = dd.key;
  } else if (dd.uri) {
    try {
      const resp = await fetch(dd.uri);
      encryptKeyBytes = new Uint8Array(await resp.arrayBuffer());
    } catch {
      downloadState.status = "error";
      downloadState.error = "无法获取解密密钥";
      return;
    }
  }

  if (!encryptKeyBytes || encryptKeyBytes.length !== 16) {
    downloadState.status = "error";
    downloadState.error = "解密密钥无效";
    return;
  }

  const keyRaw = new Uint8Array(encryptKeyBytes);
  encryptKey = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  // IV：如果显式指定了 IV 就用它，否则用片段 SN（大端序 16 字节）
  if (dd.iv instanceof Uint8Array && dd.iv.length === 16) {
    const fixedIV = new Uint8Array(dd.iv);
    ivForFrag = () => fixedIV;
  } else {
    ivForFrag = (sn: number) => {
      const iv = new Uint8Array(16);
      for (let i = 15; i >= 8; i--) {
        iv[i] = sn & 0xff;
        sn >>>= 8;
      }
      return iv;
    };
  }
}

async function decryptChunk(
  data: ArrayBuffer,
  sn: number,
): Promise<ArrayBuffer> {
  if (encryptMethod !== "AES-128" || !encryptKey) return data;
  const iv = ivForFrag!(sn);
  return crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv as BufferSource },
    encryptKey,
    data,
  );
}

/** 获取片段的实际 SN（用于 IV 计算） */
function getFragSn(index: number): number {
  const { hls } = usePlayerStore();
  if (!hls) return -1;

  try {
    const levelIndex = hls.currentLevel === -1 ? 0 : hls.currentLevel;
    const frag = hls.levels[levelIndex]?.details?.fragments?.[index];
    if (frag && typeof frag.sn === "number") return frag.sn;
  } catch {}
  return index;
}

/** 每帧由 rAF loop 调用一次：若还有空闲槽位就分发新任务 */
function drainQueue() {
  if (downloadState.status !== "downloading") return;

  while (activeCount < MAX_CONCURRENT) {
    const index = nextIndex++;
    if (index >= downloadState.urls.length) {
      if (activeCount === 0) checkDone();
      return;
    }

    const url = downloadState.urls[index];
    if (!url) continue;

    activeCount++;
    downloadOne(index, getFragSn(index));
  }
}

/** 下载单个片段，完成后自动退池 */
async function downloadOne(index: number, sn: number) {
  const controller = new AbortController();
  activeControllers.add(controller);

  try {
    const resp = await fetch(downloadState.urls[index], {
      signal: controller.signal,
    });

    if (!resp.ok) {
      downloadState.status = "error";
      downloadState.error = `片段 ${index + 1}/${downloadState.urls.length} 返回 ${resp.status}`;
      for (const c of activeControllers) if (c !== controller) c.abort();
      activeControllers.clear();
      return;
    }

    let buf = await resp.arrayBuffer();

    // 如果片段加密，解密它
    if (encryptMethod === "AES-128" && encryptKey) {
      try {
        buf = await decryptChunk(buf, sn);
      } catch {
        downloadState.status = "error";
        downloadState.error = `片段 ${index + 1} 解密失败`;
        for (const c of activeControllers) if (c !== controller) c.abort();
        activeControllers.clear();
        return;
      }
    }

    downloadState.chunks[index] = buf;
    downloadState.downloadedBytes += buf.byteLength;
    downloadState.completedCount++;
    fragTimestamps.push(Date.now());
    recordSpeed(buf.byteLength);
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    downloadState.status = "error";
    downloadState.error = `片段 ${index + 1} 失败: ${err?.message || String(err)}`;
    for (const c of activeControllers) if (c !== controller) c.abort();
    activeControllers.clear();
    return;
  } finally {
    activeControllers.delete(controller);
    activeCount--;
  }
}

function checkDone() {
  if (downloadState.status !== "downloading") return;
  if (downloadState.completedCount >= downloadState.urls.length) {
    downloadState.status = "done";
    saveFile();
  }
}

function recordSpeed(bytes: number) {
  const now = Date.now();
  speedSamples.push({ time: now, bytes });
  const cutoff = now - 3000;
  speedSamples = speedSamples.filter((s) => s.time >= cutoff);

  if (speedSamples.length >= 2) {
    const totalBytes = speedSamples.reduce((s, v) => s + v.bytes, 0);
    const timeSpan =
      (speedSamples[speedSamples.length - 1].time - speedSamples[0].time) /
      1000;
    downloadState.speed = timeSpan > 0 ? totalBytes / timeSpan : 0;
  }
}

export function pauseDownload() {
  downloadState.status = "paused";
  for (const c of activeControllers) c.abort();
  activeControllers.clear();
  // 下一帧 rAF loop 检测到 paused → 不调用 drainQueue → 停止分发
}

export function resumeDownload() {
  const firstMissing = downloadState.chunks.findIndex((c) => c === null);
  nextIndex = firstMissing >= 0 ? firstMissing : downloadState.urls.length;
  downloadState.status = "downloading";
  // 下一帧 rAF loop 自动调用 drainQueue
}

function saveFile() {
  const validChunks = downloadState.chunks.filter(Boolean) as ArrayBuffer[];
  if (validChunks.length === 0) return;

  const blob = new Blob(validChunks, { type: "video/mp2t" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = downloadState.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function resetState() {
  for (const c of activeControllers) c.abort();
  activeControllers.clear();
  downloadState.status = "idle";
  downloadState.urls = [];
  downloadState.chunks = [];
  downloadState.downloadedBytes = 0;
  downloadState.completedCount = 0;
  downloadState.speed = 0;
  downloadState.error = "";
  speedSamples = [];
  fragTimestamps.length = 0;
  nextIndex = 0;
}

// ---- rAF 分发循环（组件挂载期间运行） ----

export function startDownloadLoop() {
  if (loopId) return;
  const tick = () => {
    if (downloadState.status === "downloading") drainQueue();
    loopId = requestAnimationFrame(tick);
  };
  loopId = requestAnimationFrame(tick);
}

export function stopDownloadLoop() {
  cancelAnimationFrame(loopId);
  loopId = 0;
}
