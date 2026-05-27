// content script 中
import Hls from "hls.js";
import Plyr from "plyr";
import "./plyr.css";
import { ContentScriptContext } from "wxt/utils/content-script-context";
import { waitForElement } from "./utils";

type PlayHistory = {
  date: number;
  lineId: string;
  name: string;
  title: string;
  videoId: string;
};

type PlaybackProgress = {
  url: string;
  time: number;
};

const getVideoId = () =>
  document.getElementById("current_id")?.getAttribute("value") ||
  window.location.pathname.replace(/\/+$/g, "").split("/").pop();

let hls = new Hls();
let player: Plyr | null = null;
let currentSource: string | null = null;

const KEY_PLAYBACK_PROGRESS = "playback_progress";

const getVideoM3U8 = () =>
  document
    .querySelector('#lineContent [name="lineData"].active')
    ?.getAttribute("udata") || "";

const getVideoTitle = () =>
  document.getElementById("video_title")?.innerText || "";

const getVideoProgress = (): PlaybackProgress | null => {
  if (!currentSource || !player) return null;

  const list = JSON.parse(
    localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
  ) as PlaybackProgress[];
  return list.find((item) => item.url === currentSource) || null;
};

const saveVideoProgress = () => {
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

  localStorage.setItem(KEY_PLAYBACK_PROGRESS, JSON.stringify(list));
};

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

      const video = document.createElement("video");
      wrapper.innerHTML = "";
      wrapper.appendChild(video);
      wrapper.parentElement!.className = "";
      (wrapper.parentElement!.querySelector(
        ":scope video",
      ) as HTMLVideoElement)!.style = "aspect-ratio: 16/9;";

      if (Hls.isSupported()) {
        // 初始化 Hls.js 并关联视频
        hls.loadSource(source);
        hls.attachMedia(video);
        currentSource = source;

        // 等待解析完成后，再初始化 Plyr，确保它接管视频控制
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
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
              "fullscreen",
            ],
          });

          let hasInited = false;

          player.on("canplay", () => {
            if (hasInited) return;
            hasInited = true;

            const progress = getVideoProgress();
            if (!progress) return;

            player!.currentTime = progress.time;
          });

          player.on("timeupdate", saveVideoProgress);
        });
      }
    },
  });

  ui.autoMount();
};

const fixBtns = (ctx: ContentScriptContext) => {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: "#lineContent .line-res [name='lineData']",
    onMount: (container) => {
      container.style.display = "none";
      const wrapper = container.parentElement?.parentElement?.parentElement;
      if (!wrapper) return;

      wrapper.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          const node = e.target as HTMLElement;
          if (node.getAttribute("name") !== "lineData") return;

          wrapper
            .querySelector(':scope .line-res > [name="lineData"].active')
            ?.classList.remove("active");
          node.classList.add("active");

          const hisData: PlayHistory = {
            date: Date.now(),
            lineId: node.id,
            title: getVideoTitle(),
            name: node.innerText,
            videoId: getVideoId() || "",
          };

          window.postMessage({ type: "SAVE_PLAY_HISTORY", data: hisData }, "*");

          const source = getVideoM3U8();
          if (!source) return;

          hls.loadSource(source);
          currentSource = source;
          player?.play();
        },
        true,
      );
    },
  });

  ui.autoMount();
};

export default defineContentScript({
  matches: ["*://www.ikanbot.com/play/*"],
  async main(ctx) {
    await injectScript("/inject-main-world.js");

    replacePlayer(ctx);
    fixBtns(ctx);
  },
});
