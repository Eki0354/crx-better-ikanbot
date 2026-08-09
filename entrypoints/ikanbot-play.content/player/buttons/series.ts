import { showSeriesSidebar } from "../../utils";

export const createSeriesBtn = () => {
  const controlsContainer = document.querySelector(".plyr__controls");
  if (!controlsContainer) {
    console.warn("未找到控件栏，延迟插入");
    return;
  }

  const playBtn = controlsContainer.querySelector(
    '.plyr__control[data-plyr="play"]',
  );
  if (playBtn && !controlsContainer.querySelector(".plyr__control--series")) {
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
