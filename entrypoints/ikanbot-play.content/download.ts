import { hls, currentSource } from "./player";

// ---- Icon ----

const downloadIcon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
)}`;

// ---- 类型 ----

const MAX_CONCURRENT = 10;

interface DownloadState {
  status: "idle" | "preparing" | "downloading" | "paused" | "done" | "error";
  urls: string[];
  chunks: (ArrayBuffer | null)[];
  downloadedBytes: number;
  completedCount: number; // 已下载完成的片段数
  speed: number; // bytes/s
  error: string;
  fileName: string;
}

// ---- 状态 ----

const dState: DownloadState = {
  status: "idle",
  urls: [],
  chunks: [],
  downloadedBytes: 0,
  completedCount: 0,
  speed: 0,
  error: "",
  fileName: "video.ts",
};

let activeControllers = new Set<AbortController>();
let nextIndex = 0; // 下一个要分配的片段索引（worker 原子消费）
let speedSamples: { time: number; bytes: number }[] = [];
let fragTimestamps: number[] = []; // 每个片段完成的时间戳，用于 ETA 滑动窗口
let popupEl: HTMLDivElement | null = null;
let styleAdded = false;
let updateTimerId = 0;

// ---- 工具函数 ----

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1) return "";
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
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
  const levelIndex = hls.currentLevel === -1 ? 0 : hls.currentLevel;
  const level = hls.levels[levelIndex];
  if (!level?.details?.fragments?.length) return [];

  const detailsUrl = level.details.url;
  return level.details.fragments
    .map((frag) => {
      return (
        frag.url ||
        (frag.relurl
          ? (detailsUrl || currentSource || "").replace(/\/[^/]*$/, "/") +
            frag.relurl
          : "")
      );
    })
    .filter(Boolean);
}

// ---- 核心下载逻辑 ----

let activeCount = 0;
let encryptKey: CryptoKey | null = null; // AES 密钥（Web Crypto 格式）
let encryptKeyBytes: Uint8Array | null = null; // 原始密钥字节
let encryptMethod = ""; // "AES-128" 或 "NONE"
let ivForFrag: ((sn: number) => Uint8Array) | null = null; // 每个片段的 IV 生成函数

function prepareDownload() {
  dState.status = "preparing";
  dState.urls = getFragmentUrls();
  dState.chunks = new Array(dState.urls.length).fill(null);
  dState.downloadedBytes = 0;
  dState.completedCount = 0;
  dState.speed = 0;
  dState.error = "";
  speedSamples = [];
  fragTimestamps = [];
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
  let baseName = title || currentSource?.split("/").pop()?.replace(/\.m3u8.*$/i, "") || "video";
  if (episode) baseName = `${baseName} - ${episode}`;
  dState.fileName = `${baseName}.ts`;

  if (dState.urls.length === 0) {
    dState.status = "error";
    dState.error = "没有可用的视频片段";
    updatePopupUI();
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

  dState.status = "downloading";
  updatePopupUI();
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
      dState.status = "error";
      dState.error = "无法获取解密密钥";
      updatePopupUI();
      return;
    }
  }

  if (!encryptKeyBytes || encryptKeyBytes.length !== 16) {
    dState.status = "error";
    dState.error = "解密密钥无效";
    updatePopupUI();
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

async function decryptChunk(data: ArrayBuffer, sn: number): Promise<ArrayBuffer> {
  if (encryptMethod !== "AES-128" || !encryptKey) return data;
  const iv = ivForFrag!(sn);
  return crypto.subtle.decrypt({ name: "AES-CBC", iv: iv as BufferSource }, encryptKey, data);
}

/** 获取片段的实际 SN（用于 IV 计算） */
function getFragSn(index: number): number {
  try {
    const levelIndex = hls.currentLevel === -1 ? 0 : hls.currentLevel;
    const frag = hls.levels[levelIndex]?.details?.fragments?.[index];
    if (frag && typeof frag.sn === "number") return frag.sn;
  } catch {}
  return index;
}

/** 每帧由 rAF loop 调用一次：若还有空闲槽位就分发新任务 */
function drainQueue() {
  if (dState.status !== "downloading") return;

  while (activeCount < MAX_CONCURRENT) {
    const index = nextIndex++;
    if (index >= dState.urls.length) {
      if (activeCount === 0) checkDone();
      return;
    }

    const url = dState.urls[index];
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
    const resp = await fetch(dState.urls[index], { signal: controller.signal });

    if (!resp.ok) {
      dState.status = "error";
      dState.error = `片段 ${index + 1}/${dState.urls.length} 返回 ${resp.status}`;
      updatePopupUI();
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
        dState.status = "error";
        dState.error = `片段 ${index + 1} 解密失败`;
        updatePopupUI();
        for (const c of activeControllers) if (c !== controller) c.abort();
        activeControllers.clear();
        return;
      }
    }

    dState.chunks[index] = buf;
    dState.downloadedBytes += buf.byteLength;
    dState.completedCount++;
    fragTimestamps.push(Date.now());
    recordSpeed(buf.byteLength);
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    dState.status = "error";
    dState.error = `片段 ${index + 1} 失败: ${err?.message || String(err)}`;
    updatePopupUI();
    for (const c of activeControllers) if (c !== controller) c.abort();
    activeControllers.clear();
    return;
  } finally {
    activeControllers.delete(controller);
    activeCount--;
  }
}

function checkDone() {
  if (dState.status !== "downloading") return;
  if (dState.completedCount >= dState.urls.length) {
    dState.status = "done";
    updatePopupUI();
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
    const timeSpan = (speedSamples[speedSamples.length - 1].time - speedSamples[0].time) / 1000;
    dState.speed = timeSpan > 0 ? totalBytes / timeSpan : 0;
  }
}

function pauseDownload() {
  dState.status = "paused";
  for (const c of activeControllers) c.abort();
  activeControllers.clear();
  updatePopupUI();
  // 下一帧 rAF loop 检测到 paused → 不调用 drainQueue → 停止分发
}

function resumeDownload() {
  const firstMissing = dState.chunks.findIndex((c) => c === null);
  nextIndex = firstMissing >= 0 ? firstMissing : dState.urls.length;
  dState.status = "downloading";
  updatePopupUI();
  // 下一帧 rAF loop 自动调用 drainQueue
}

function saveFile() {
  const validChunks = dState.chunks.filter(Boolean) as ArrayBuffer[];
  if (validChunks.length === 0) return;

  const blob = new Blob(validChunks, { type: "video/mp2t" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dState.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ---- 弹窗 UI ----

function addStyles() {
  if (styleAdded) return;
  styleAdded = true;

  const style = document.createElement("style");
  style.textContent = `
    .plyr__download-panel {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 10px;
      background: rgba(0,0,0,0.88);
      border-radius: 8px;
      padding: 14px 16px;
      min-width: 300px;
      color: #fff;
      font-size: 13px;
      backdrop-filter: blur(10px);
      z-index: 1000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      pointer-events: auto;
    }
    .plyr__download-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-weight: 600;
      font-size: 14px;
    }
    .plyr__download-panel-close {
      background: none;
      border: none;
      color: #999;
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .plyr__download-panel-close:hover { color: #fff; }
    .plyr__download-progress-wrap {
      margin-bottom: 8px;
    }
    .plyr__download-progress-bar {
      height: 6px;
      background: rgba(255,255,255,0.15);
      border-radius: 3px;
      overflow: hidden;
    }
    .plyr__download-progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #00b3ff, #0066ff);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .plyr__download-progress-fill.done { background: linear-gradient(90deg, #00cc66, #00994d); }
    .plyr__download-progress-fill.error { background: linear-gradient(90deg, #ff4444, #cc0000); }
    .plyr__download-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #bbb;
      flex-wrap: wrap;
      min-height: 18px;
    }
    .plyr__download-info .left { display: flex; gap: 12px; }
    .plyr__download-info .right { display: flex; gap: 12px; }
    .plyr__download-panel-footer {
      margin-top: 10px;
      display: flex;
      gap: 8px;
    }
    .plyr__download-panel-footer .spacer { flex: 1; }
    .plyr__download-btn {
      padding: 7px 16px;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 4px;
      background: transparent;
      color: #fff;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .plyr__download-btn:hover { background: rgba(255,255,255,0.1); }
    .plyr__download-btn--primary { background: #0066ff; border-color: #0066ff; }
    .plyr__download-btn--primary:hover { background: #0052cc; }
    .plyr__download-btn--warning { background: #ff8c00; border-color: #ff8c00; }
    .plyr__download-btn--warning:hover { background: #cc7000; }
    .plyr__download-btn--success { background: #00b341; border-color: #00b341; }
    .plyr__download-btn--success:hover { background: #009933; }
    .plyr__download-btn--danger { background: #e53935; border-color: #e53935; }
    .plyr__download-btn--danger:hover { background: #b71c1c; }
    .plyr__download-error { color: #ff6666; font-size: 12px; margin-top: 4px; }
    .plyr__download-done-msg { color: #66cc88; font-size: 12px; margin-top: 4px; }
    .plyr__download-copy-link {
      margin-top: 8px;
      font-size: 12px;
    }
    .plyr__download-copy-link span {
      color: #888;
      cursor: pointer;
      text-decoration: none;
      transition: color 0.15s;
    }
    .plyr__download-copy-link span:hover { color: #fff; }
    .plyr__download-copy-link .copied { color: #66cc88; }
  `;
  document.head.appendChild(style);
}

function createPopupEl(): HTMLDivElement {
  addStyles();

  const panel = document.createElement("div");
  panel.className = "plyr__download-panel";
  panel.innerHTML = `
    <div class="plyr__download-panel-header">
      <span class="plyr__download-panel-title">下载视频</span>
      <button class="plyr__download-panel-close">&times;</button>
    </div>
    <div class="plyr__download-progress-wrap">
      <div class="plyr__download-progress-bar">
        <div class="plyr__download-progress-fill"></div>
      </div>
    </div>
    <div class="plyr__download-info">
      <span class="left">
        <span class="plyr__download-size"></span>
        <span class="plyr__download-speed"></span>
      </span>
      <span class="right">
        <span class="plyr__download-eta"></span>
      </span>
    </div>
    <div class="plyr__download-extra-msg"></div>
    <div class="plyr__download-panel-footer"></div>
    <div class="plyr__download-copy-link"><span class="copy-trigger">复制 m3u8 链接</span></div>
  `;

  // 复制链接按钮
  const copySpan = panel.querySelector(".copy-trigger") as HTMLElement;
  if (copySpan) {
    copySpan.addEventListener("click", async () => {
      const url = currentSource || "";
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        copySpan.textContent = "已复制";
        copySpan.className = "copied";
        setTimeout(() => {
          copySpan.textContent = "复制 m3u8 链接";
          copySpan.className = "copy-trigger";
        }, 2000);
      } catch {
        // 降级方案
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        copySpan.textContent = "已复制";
        copySpan.className = "copied";
        setTimeout(() => {
          copySpan.textContent = "复制 m3u8 链接";
          copySpan.className = "copy-trigger";
        }, 2000);
      }
    });
  }

  return panel;
}

let lastFooterStatus = ""; // 记录上次构建按钮时的状态，避免每帧重建

function updatePopupUI() {
  if (!popupEl) return;

  const fill = popupEl.querySelector(".plyr__download-progress-fill") as HTMLElement;
  const sizeEl = popupEl.querySelector(".plyr__download-size") as HTMLElement;
  const speedEl = popupEl.querySelector(".plyr__download-speed") as HTMLElement;
  const etaEl = popupEl.querySelector(".plyr__download-eta") as HTMLElement;
  const footer = popupEl.querySelector(".plyr__download-panel-footer") as HTMLElement;
  const msgEl = popupEl.querySelector(".plyr__download-extra-msg") as HTMLElement;
  const titleEl = popupEl.querySelector(".plyr__download-panel-title") as HTMLElement;

  if (!fill || !footer) return;

  const total = dState.urls.length;
  const done = Math.min(dState.completedCount, total);

  // ---- 每帧都刷新的部分 ----

  fill.style.width = `${total > 0 ? (done / total) * 100 : 0}%`;
  fill.className = `plyr__download-progress-fill ${
    dState.status === "done" ? "done" : dState.status === "error" ? "error" : ""
  }`;

  sizeEl.textContent = total > 0 ? `第 ${done}/${total} 个片段` : "";

  const speedStr = formatSpeed(dState.speed);
  speedEl.textContent = speedStr;

  const etaStr = dState.completedCount > 0 && total > dState.completedCount
    ? (() => {
        const now = Date.now();
        const recent = fragTimestamps.filter((t) => t >= now - 5000);
        const c = recent.length;
        if (c === 0) return "";
        const e = (recent[c - 1] - recent[0]) / 1000 || 1;
        const est = (total - dState.completedCount) / (c / e);
        return est > 0 ? formatEta(est) : "";
      })()
    : "";
  etaEl.textContent = etaStr;

  // ---- 状态不变时不再重建按钮和标题 ----

  if (lastFooterStatus === dState.status) return;
  lastFooterStatus = dState.status;

  // 标题
  titleEl.textContent =
    dState.status === "done" ? "下载完成" :
    dState.status === "error" ? "下载失败" :
    "下载视频";

  // 额外消息
  msgEl.innerHTML = "";
  if (dState.status === "error") {
    const errEl = document.createElement("div");
    errEl.className = "plyr__download-error";
    errEl.textContent = dState.error;
    msgEl.appendChild(errEl);
  } else if (dState.status === "done") {
    const doneEl = document.createElement("div");
    doneEl.className = "plyr__download-done-msg";
    doneEl.textContent = "文件已保存，点击关闭按钮";
    msgEl.appendChild(doneEl);
  }

  // 页脚按钮
  footer.innerHTML = "";
  if (dState.status === "idle" || dState.status === "preparing") {
    const btn = document.createElement("button");
    btn.className = "plyr__download-btn plyr__download-btn--primary";
    btn.textContent = dState.status === "preparing" ? "准备中..." : "开始下载";
    btn.disabled = dState.status === "preparing";
    btn.addEventListener("click", () => prepareDownload());
    footer.appendChild(btn);
  } else if (dState.status === "downloading") {
    const btn = document.createElement("button");
    btn.className = "plyr__download-btn plyr__download-btn--warning";
    btn.textContent = "暂停";
    btn.addEventListener("click", () => pauseDownload());
    footer.appendChild(btn);
  } else if (dState.status === "paused") {
    const btn1 = document.createElement("button");
    btn1.className = "plyr__download-btn plyr__download-btn--success";
    btn1.textContent = "继续";
    btn1.addEventListener("click", () => resumeDownload());
    footer.appendChild(btn1);
    const btn2 = document.createElement("button");
    btn2.className = "plyr__download-btn";
    btn2.textContent = "取消";
    btn2.addEventListener("click", () => { resetState(); updatePopupUI(); });
    footer.appendChild(btn2);
  } else if (dState.status === "done") {
    const btn = document.createElement("button");
    btn.className = "plyr__download-btn plyr__download-btn--primary";
    btn.textContent = "关闭";
    btn.addEventListener("click", hidePopup);
    footer.appendChild(btn);
  } else if (dState.status === "error") {
    const btn1 = document.createElement("button");
    btn1.className = "plyr__download-btn plyr__download-btn--danger";
    btn1.textContent = "重试";
    btn1.addEventListener("click", () => prepareDownload());
    footer.appendChild(btn1);
    const btn2 = document.createElement("button");
    btn2.className = "plyr__download-btn";
    btn2.textContent = "关闭";
    btn2.addEventListener("click", hidePopup);
    footer.appendChild(btn2);
  }
}

function resetState() {
  for (const c of activeControllers) c.abort();
  activeControllers.clear();
  dState.status = "idle";
  lastFooterStatus = "";
  dState.urls = [];
  dState.chunks = [];
  dState.downloadedBytes = 0;
  dState.completedCount = 0;
  dState.speed = 0;
  dState.error = "";
  speedSamples = [];
  nextIndex = 0;
}

function hidePopup() {
  if (updateTimerId) {
    cancelAnimationFrame(updateTimerId);
    updateTimerId = 0;
  }
  popupEl?.remove();
  popupEl = null;
  lastFooterStatus = "";
}

function showPopup(downloadBtn: HTMLElement) {
  // 若已打开则关闭
  if (popupEl) {
    hidePopup();
    return;
  }

  // 找到最近的 .plyr 容器
  const plyrEl = downloadBtn.closest(".plyr") as HTMLElement;
  if (!plyrEl) return;

  popupEl = createPopupEl();

  // 关闭按钮
  const closeBtn = popupEl.querySelector(
    ".plyr__download-panel-close",
  ) as HTMLElement;
  closeBtn.addEventListener("click", hidePopup);

  // 点击外部关闭（用 composedPath 避免按钮被重建后 e.target 脱离 DOM 导致的误判）
  const outsideHandler = (e: MouseEvent) => {
    const path = e.composedPath?.() || [];
    const inPanel = path.some(
      (el) => el instanceof Element && el.classList?.contains("plyr__download-panel"),
    );
    if (popupEl && !inPanel && e.target !== downloadBtn) {
      hidePopup();
      document.removeEventListener("click", outsideHandler);
    }
  };
  setTimeout(() => document.addEventListener("click", outsideHandler), 0);

  // 将弹窗插入到 .plyr__controls 内作为其子元素
  // 这样 bottom: 100% 以 controls 为锚点，弹窗出现在控件栏上方
  const controls = plyrEl.querySelector(".plyr__controls") as HTMLElement;
  if (controls) {
    if (getComputedStyle(controls).position === "static") {
      controls.style.position = "relative";
    }
    controls.appendChild(popupEl);
  } else {
    plyrEl.appendChild(popupEl);
  }

  updatePopupUI();

  // rAF loop：弹窗存活期间一直运行，用于刷新 UI + 分发下载
  function loop() {
    if (!popupEl) { updateTimerId = 0; return; }
    if (dState.status === "downloading") drainQueue();
    updatePopupUI();
    updateTimerId = requestAnimationFrame(loop);
  }
  loop();
}

// ---- 按钮创建 ----

export function createDownloadBtn() {
  const controlsContainer = document.querySelector(".plyr__controls");
  if (!controlsContainer) return;

  const fullBtn = controlsContainer.querySelector(
    '.plyr__control[data-plyr="fullscreen"]',
  );
  if (!fullBtn) return;

  if (controlsContainer.querySelector(".plyr__control--download")) return;

  const downloadBtn = document.createElement("button");
  downloadBtn.className =
    "plyr__control plyr__control--custom plyr__control--download";
  downloadBtn.innerHTML = `<img src="${downloadIcon}" alt="下载" style="width: 18px; aspect-ratio: square;" />`;
  downloadBtn.setAttribute("aria-label", "下载视频");
  downloadBtn.setAttribute("data-plyr-tooltip", "下载视频");
  downloadBtn.setAttribute("data-plyr-tooltip-persistent", "false");

  downloadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showPopup(downloadBtn);
  });

  controlsContainer.insertBefore(downloadBtn, fullBtn);
}
