import { getVideoTitle } from "../../series";

/** 对当前视频画面截图并下载为 PNG */
export const takeScreenshot = () => {
  const video: HTMLVideoElement | null = document.querySelector(".plyr video");
  if (!video) return;

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(video, 0, 0, w, h);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ikanbot-screenshot-${getVideoTitle()}-${video.currentTime || "00"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
};

/** 在 Plyr 设置菜单中注入"截图"选项 */
export const createScreenshotMenuItem = () => {
  const settingsBtn = document.querySelector(
    '.plyr__control[data-plyr="settings"]',
  );
  if (!settingsBtn) return;

  const tryInject = () => {
    const menuContainer = document.querySelector(".plyr__menu__container");
    if (!menuContainer) return false;

    const menu = menuContainer.querySelector('[role="menu"]');
    if (!menu) return false;

    // 避免重复注入
    if (menu.querySelector(".plyr__control--screenshot")) return true;

    const item = document.createElement("button");
    item.className = "plyr__control plyr__control--screenshot";
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "0");
    item.innerHTML = '<span class="plyr__menu__label">截图</span>';

    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 关闭设置菜单
      (settingsBtn as HTMLElement).click();

      takeScreenshot();
    });

    menu.appendChild(item);
    return true;
  };

  // 如果菜单 DOM 已存在则直接注入，否则等用户首次点击设置按钮后再注入
  if (tryInject()) return;

  const handler = () => {
    setTimeout(() => tryInject(), 100);
  };
  settingsBtn.addEventListener("click", handler, { once: true });
};
