// entrypoints/inject-play.ts

export default defineUnlistedScript(() => {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    switch (event.data?.type) {
      case "DISPOSE_SOURCE_VIDEO":
        const node = document.getElementById("ikanbot-player");
        (node as any)?.player?.dispose();
        node?.remove();
        break;
      case "SAVE_PLAY_HISTORY":
        (window as any).savePlayHistory(event.data.data);
        break;
    }
  });
});
