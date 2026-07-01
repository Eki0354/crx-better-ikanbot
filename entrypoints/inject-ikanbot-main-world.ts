// entrypoints/inject-main-world.ts
declare var A_Store: any;

export default defineUnlistedScript(() => {
  try {
    A_Store.isCooldown = () => true; // 屏蔽广告判断逻辑
  } catch (e) {
    console.warn("Failed to override A_Store.isCooldown:", e);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    switch (event.data?.type) {
      case "DISPOSE_SOURCE_VIDEO":
        (document.getElementById("ikanbot-player") as any)?.player?.dispose();
        break;
      case "SAVE_PLAY_HISTORY":
        (window as any).savePlayHistory(event.data.data);
        break;
    }
  });
});
