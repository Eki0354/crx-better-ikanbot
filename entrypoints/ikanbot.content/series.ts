import { ContentScriptContext } from "#imports";
import { hideSeriesSidebar, showSeriesSidebar } from "./utils";
import { playVideo } from "./player";

const SIDEBAR_WIDTH_KEY = "betterIkanbot_sidebarWidth";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH_RATIO = 0.5;

const CN_BS = "bad-source";

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

function setBadSource(btn: Element, isBad = true) {
  if (isBad) {
    if (!btn.classList.contains(CN_BS)) {
      btn.classList.add(CN_BS);
    }
  } else {
    btn.classList.remove(CN_BS);
  }
}

async function onVerifySources() {
  const btns = Array.from(
    document.querySelectorAll("#lineContent .line-res [name='lineData']"),
  );

  const promises = btns.map(async (btn) => {
    const source = btn.getAttribute("udata");
    if (!source) return;

    try {
      const res = await fetch(source);

      const isOk = res.ok && res.status === 200;
      setBadSource(btn, !isOk);

      return isOk;
    } catch (error) {
      setBadSource(btn, true);
      return false;
    }
  });

  return Promise.all(promises);
}

const fixSeries = (ctx: ContentScriptContext) => {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: ".row:has(#playList)",
    onMount: (container) => {
      container.className = "container-collapse";

      const sidebar: HTMLElement | null = container.closest(
        ".row:has(#playList)",
      );
      if (!sidebar) return;

      const verifyBtn = document.createElement("button");
      verifyBtn.className = "btn-verify";
      verifyBtn.textContent = "标记无效源";
      verifyBtn.addEventListener("click", onVerifySources);

      // 节点排列为column-reverse，所以插入到最后让其显示在顶部
      sidebar.appendChild(verifyBtn);

      // 加载保存的宽度
      const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (savedWidth) {
        const w = parseInt(savedWidth, 10);
        if (
          w >= SIDEBAR_MIN_WIDTH &&
          w <= window.innerWidth * SIDEBAR_MAX_WIDTH_RATIO
        ) {
          sidebar.style.width = w + "px";
        }
      }

      // 折叠 / 展开按钮
      const collapseBtn = document.createElement("button");
      collapseBtn.className = "btn-collapse";
      collapseBtn.innerHTML = "◀";
      collapseBtn.title = "收起侧边栏";

      const expandBtn = document.createElement("button");
      expandBtn.className = "btn-expand";
      expandBtn.innerHTML = "▶";
      expandBtn.title = "展开侧边栏";

      container.appendChild(collapseBtn);
      document.body.appendChild(expandBtn);

      collapseBtn.addEventListener("click", hideSeriesSidebar);
      expandBtn.addEventListener("click", showSeriesSidebar);

      // 拖拽改变宽度
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      sidebar.appendChild(handle);

      let isDragging = false;

      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        isDragging = true;
        handle.classList.add("is-dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        let newWidth = e.clientX;
        newWidth = Math.max(newWidth, SIDEBAR_MIN_WIDTH);
        newWidth = Math.min(
          newWidth,
          window.innerWidth * SIDEBAR_MAX_WIDTH_RATIO,
        );
        sidebar.style.width = newWidth + "px";
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        // isDragging = false;
        handle.classList.remove("is-dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // 保存宽度
        const w = sidebar.offsetWidth;
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
      };

      handle.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp, true);

      // 点击侧边栏外部自动收起
      const onOutsideClick = (e: MouseEvent) => {
        // mouseup必须先于本事件触发，所以状态在这里进行改变
        if (isDragging) {
          isDragging = false;
          return;
        }

        const node: HTMLDivElement | null = document.querySelector(
          ".row:has(#playList)",
        );
        if (!node || !node.style.display || node.style.display === "none")
          return;
        if (node.contains(e.target as Node)) return;

        e.preventDefault();
        e.stopPropagation();

        node.style.display = "none";
      };

      window.addEventListener("click", onOutsideClick, true);
    },
  });

  ui.autoMount();
};

export { getVideoId, getVideoTitle, getVideoM3U8, fixBtns, fixSeries };
