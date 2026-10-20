import { ContentScriptContext } from "#imports";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./progress";
import Toast from "@lanxuexing/vue2toast";
import "@lanxuexing/vue2toast/style.css";

export function initPlayer(ctx: ContentScriptContext) {
  const ui = createIntegratedUi(ctx, {
    position: "inline",
    anchor: "#lineContent .line-res .active[name='lineData']",
    // anchor: "#player-wrap > .video-js > video",
    onMount: (container) => {
      container.style.display = "none";

      const app = createApp(App);

      const pinia = createPinia();
      app.use(pinia);
      
      app.use(Toast);

      app.mount(container);
    },
  });

  ui.autoMount();
}
