import { ContentScriptContext } from "#imports";
import { playVideo } from "./player";
import SeriesApp from "./series/App.vue";

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

const getVideoTitle = () =>
  document.getElementById("video_title")?.innerText || "";

const getVideoM3U8 = () =>
  document
    .querySelector('#lineContent [name="lineData"].active')
    ?.getAttribute("udata") || "";

const fixBtns = (ctx: ContentScriptContext) => {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: "#lineContent .line-res [name='lineData']",
    onMount: (container) => {
      container.style.display = "none";
      const wrapper = document.getElementById("lineContent");
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

          window.postMessage({ type: "SAVE_PLAY_HISTORY", data: hisData }, "/");

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

const fixSeries = (ctx: ContentScriptContext) => {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: ".row:has(#playList)",
    onMount: (container) => {
      container.className = "container-collapse";

      const app = createApp(SeriesApp);
      app.mount(container);
    },
  });

  ui.autoMount();
};

export { getVideoId, getVideoTitle, getVideoM3U8, fixBtns, fixSeries };
