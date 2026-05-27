import "./plyr.css";
import { ContentScriptContext } from "wxt/utils/content-script-context";
import { waitForElement } from "./utils";
import { initPlayer, playVideo } from './player';

type PlayHistory = {
  date: number;
  lineId: string;
  name: string;
  title: string;
  videoId: string;
};

const getVideoId = () =>
  document.getElementById("current_id")?.getAttribute("value") ||
  window.location.pathname.replace(/\/+$/g, "").split("/").pop();

const getVideoM3U8 = () =>
  document
    .querySelector('#lineContent [name="lineData"].active')
    ?.getAttribute("udata") || "";

const getVideoTitle = () =>
  document.getElementById("video_title")?.innerText || "";

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

      initPlayer(video, source);
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
          
          playVideo(source);
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
