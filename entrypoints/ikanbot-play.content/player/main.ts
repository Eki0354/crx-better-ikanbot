import { ContentScriptContext } from "#imports";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./progress";

export function initPlayer(ctx: ContentScriptContext) {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: "#lineContent .line-res .active[name='lineData']",
    // anchor: "#player-wrap > .video-js > video",
    onMount: (container) => {
      const app = createApp(App);

      const pinia = createPinia();
      app.use(pinia);

      app.mount(container);
    },
  });

  ui.autoMount();
}
