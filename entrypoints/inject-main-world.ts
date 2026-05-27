// entrypoints/inject-main-world.ts
declare var A_Store: any;

export default defineUnlistedScript(() => {
  // 这里的代码可以访问原页面的 window 变量
  console.log(
    "Inject script in MAIN world, page title:",
    window.document.title,
  );
  console.log("Page variable v_tks:", (window as any).v_tks);

  localStorage.setItem("token", (window as any).v_tks);

  try {
    A_Store.isCooldown = () => true; // 屏蔽广告判断逻辑
  } catch (e) {
    console.warn("Failed to override A_Store.isCooldown:", e);
  }

  window.addEventListener("message", (event) => {
    if (event.source === window && event.data?.type === "SAVE_PLAY_HISTORY") {
      (window as any).savePlayHistory(event.data.data);
    }
  });
});
