import nextIcon from "~/assets/next.png";

export const createNextBtn = () => {
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
