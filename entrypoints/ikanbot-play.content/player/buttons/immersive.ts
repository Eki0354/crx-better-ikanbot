import immersiveIcon from "~/assets/immersive.png";

export const createImmersiveBtn = () => {
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
