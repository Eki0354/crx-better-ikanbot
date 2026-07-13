// entrypoints/inject-play.ts

export default defineUnlistedScript(() => {
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
