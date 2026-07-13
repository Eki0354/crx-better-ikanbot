import Hls from "hls.js";
import Plyr from "plyr";
import nextIcon from "~/assets/next.png";
import immersiveIcon from "~/assets/immersive.png";
import { debounce } from "lodash-es";
import { sendMessage, onMessage } from "webext-bridge/content-script";
import { createDownloadBtn } from "./download";
import { showSeriesSidebar, waitForElement } from "./utils";
import { ContentScriptContext } from "#imports";
import { getVideoM3U8 } from "./series";

type PlaybackProgress = {
  url: string;
  time: number;
};

let hls = new Hls();
let player: Plyr | null = null;
let currentSource: string | null = null;

const KEY_PLAYBACK_PROGRESS = "playback_progress";

const getVideoProgress = (): PlaybackProgress | null => {
  if (!currentSource || !player) return null;

  const list = JSON.parse(
    localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
  ) as PlaybackProgress[];
  return list.find((item) => item.url === currentSource) || null;
};

const saveVideoProgress = debounce(
  () => {
    if (!currentSource || !player) return;

    const list = JSON.parse(
      localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
    ) as PlaybackProgress[];
    const existingIndex = list.findIndex((item) => item.url === currentSource);

    const newProgress: PlaybackProgress = {
      url: currentSource,
      time: player.currentTime,
    };

    if (existingIndex >= 0) {
      list[existingIndex] = newProgress;
    } else {
      list.push(newProgress);
    }

    const str = JSON.stringify(list);
    localStorage.setItem(KEY_PLAYBACK_PROGRESS, str);
    sendMessage("playback_progress", str, "background");
  },
  1000,
  { trailing: true, maxWait: 1000 },
);

const createNextBtn = () => {
  const controlsContainer = document.querySelector(".plyr__controls");
  if (!controlsContainer) {
    console.warn("未找到控件栏，延迟插入");
    return;
  }

  const playBtn = controlsContainer.querySelector(
    '.plyr__control[data-plyr="play"]',
  );
  if (
    playBtn &&
    !controlsContainer.querySelector(".plyr__control--next-episode")
  ) {
    // 创建下一集按钮
    const nextBtn = document.createElement("button");
    nextBtn.className =
      "plyr__control plyr__control--custom plyr__control--next-episode";
    nextBtn.setAttribute("data-plyr", "next-episode");
    nextBtn.setAttribute("aria-label", "下一集");
    // 使用 Font Awesome 前进双箭头图标 (更直观)
    nextBtn.innerHTML = `<img src="${nextIcon}" alt="下一集" style="width: 18px; aspect-ratio: square;" />`;
    // 添加工具提示 (Plyr 风格)
    nextBtn.setAttribute("data-plyr-tooltip", "下一集");
    nextBtn.setAttribute("data-plyr-tooltip-persistent", "false");

    // 绑定点击事件 - 执行播放下一集逻辑 (业务自定义)
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      //   playNextEpisode(); // 自定义逻辑，完全可替换

      const node = document.querySelector(
        '#lineContent .line-res [name="lineData"].active ~ [name="lineData"]',
      ) as HTMLElement;
      if (!node) return;

      node.click();
    });

    // 插入到播放按钮后面 (作为兄弟节点)
    if (playBtn.nextSibling) {
      controlsContainer.insertBefore(nextBtn, playBtn.nextSibling);
    } else {
      controlsContainer.appendChild(nextBtn);
    }
  }
};

const createSeriesBtn = () => {
  const controlsContainer = document.querySelector(".plyr__controls");
  if (!controlsContainer) {
    console.warn("未找到控件栏，延迟插入");
    return;
  }

  const playBtn = controlsContainer.querySelector(
    '.plyr__control[data-plyr="play"]',
  );
  if (
    playBtn &&
    !controlsContainer.querySelector(".plyr__control--series")
  ) {
    // 创建剧集按钮
    const seriesBtn = document.createElement("button");
    seriesBtn.className =
      "plyr__control plyr__control--custom plyr__control--series";
    seriesBtn.setAttribute("aria-label", "剧集");
    seriesBtn.textContent = "剧集";

    // 绑定点击事件 - 执行播放下一集逻辑 (业务自定义)
    seriesBtn.addEventListener("click", showSeriesSidebar);

    // 插入到播放按钮后面 (作为兄弟节点)
    if (playBtn.nextSibling) {
      controlsContainer.insertBefore(seriesBtn, playBtn.nextSibling);
    } else {
      controlsContainer.appendChild(seriesBtn);
    }
  }
};

const createImmersiveBtn = () => {
  const controlsContainer = document.querySelector(".plyr__controls");
  if (!controlsContainer) {
    console.warn("未找到控件栏，延迟插入");
    return;
  }

  const fullBtn = controlsContainer.querySelector(
    '.plyr__control[data-plyr="fullscreen"]',
  );

  if (fullBtn) {
    const immBtn = document.createElement("button");
    immBtn.className =
      "plyr__control plyr__control--custom plyr__control--immersive";
    immBtn.innerHTML = `<img src="${immersiveIcon}" alt="沉浸模式" style="width: 18px; aspect-ratio: square;" />`;
    immBtn.setAttribute("aria-label", "沉浸模式");
    let immActive = false;
    const plyrEl = document.querySelector(".plyr") as HTMLElement;
    const toggleImmersiveFallback = () => {
      if (!plyrEl) return;
      if (!immActive) {
        plyrEl.classList.add("immersive-mode");
        plyrEl.style.position = "fixed";
        plyrEl.style.top = "0";
        plyrEl.style.left = "0";
        plyrEl.style.width = "100vw";
        plyrEl.style.height = "100vh";
        plyrEl.style.zIndex = "9999";
        document.body.classList.add("no-scroll");
        immActive = true;
      } else {
        plyrEl.classList.remove("immersive-mode");
        plyrEl.style.position = "";
        plyrEl.style.top = "";
        plyrEl.style.left = "";
        plyrEl.style.width = "";
        plyrEl.style.height = "";
        plyrEl.style.zIndex = "";
        document.body.classList.remove("no-scroll");
        immActive = false;
        window.dispatchEvent(new Event("resize"));
      }
    };
    immBtn.addEventListener("click", toggleImmersiveFallback);
    controlsContainer.insertBefore(immBtn, fullBtn);
    // esc 支持
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && immActive) toggleImmersiveFallback();
    };
    window.removeEventListener(
      "keydown",
      (window as any).__immersiveEscHandler,
    );
    (window as any).__immersiveEscHandler = escHandler;
    window.addEventListener("keydown", escHandler);
  }
};

function playVideo(source: string) {
  hls.loadSource(source);
  currentSource = source;
  player?.play();
}

function initPlayer(video: HTMLVideoElement, source: string, isInitial = true) {
  player = new Plyr(video, {
    keyboard: {
      global: true,
    },
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "duration",
      "mute",
      "volume",
      "settings",
      "fullscreen",
    ],
    i18n: {
      speed: "速度",
      normal: "1.0x",
    },
  });

  let hasInited = false;

  player.on("canplay", () => {
    if (hasInited) return;
    hasInited = true;

    const progress = getVideoProgress();
    if (progress) {
      player!.currentTime = progress.time;
    }

    if (!isInitial) {
      player!.play();
    }
  });

  player.on("ready", createSeriesBtn);
  player.on("ready", createNextBtn);
  player.on("ready", createDownloadBtn);
  player.on("ready", createImmersiveBtn);

  player.on("timeupdate", saveVideoProgress);

  if (!Hls.isSupported()) return;

  // 初始化 Hls.js 并关联视频
  hls.loadSource(source);
  hls.attachMedia(video);
  currentSource = source;

  // 等待解析完成后，再初始化 Plyr，确保它接管视频控制
  hls.on(Hls.Events.MANIFEST_PARSED, function () {
    // 清除错误信息
    document.getElementById("bi-error-text")?.remove();
  });

  hls.on(Hls.Events.ERROR, () => {
    const pn = video.parentElement!;

    if (pn.style.position === "") {
      pn.style.position = "relative";
    }

    const em = document.createElement("div");
    em.id = "bi-error-text";
    em.textContent = "资源无法加载，请尝试换源";

    Object.assign(em.style, {
      fontSize: "18px",
      position: "absolute",
      left: "50%",
      top: "40%",
      transform: "translate3d(-50%, -50%, 0)",
      color: '#ddd',
    });

    pn.appendChild(em);
  });
}

const replacePlayer = (ctx: ContentScriptContext) => {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: "#player-wrap > .video-js > video",
    onMount: async (container) => {
      container.style.display = "none";
      const vj = container.parentElement as HTMLVideoElement;
      if (!vj) return;

      const wrapper = vj.parentElement?.parentElement;
      if (!wrapper) return;

      const el = await waitForElement(
        "#lineContent .line-res .active[name='lineData']",
      );
      if (!el) return;

      const source = getVideoM3U8();
      if (!source) return;

      window.postMessage({ type: "DISPOSE_SOURCE_VIDEO" }, "/");

      const video = document.createElement("video");
      wrapper.innerHTML = "";
      wrapper.appendChild(video);
      wrapper.parentElement!.className = "";
      (wrapper.parentElement!.querySelector(
        ":scope video",
      ) as HTMLVideoElement)!.style = "aspect-ratio: 16/9;";

      initPlayer(video, source);
    },
  });

  ui.autoMount();
};

export { player, initPlayer, replacePlayer, playVideo, hls, currentSource };

// 监听远程同步：从 Dropbox 拉取的数据写回本地
onMessage("sync_progress", ({ data }) => {
  const payload = data as string;
  if (payload) {
    localStorage.setItem(KEY_PLAYBACK_PROGRESS, payload);
  }
});

// 监听获取当前进度请求：popup 手动上传时调用
onMessage("get_progress", () => {
  return localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "";
});
