import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  webExt: {
    disabled: true,
  },
  manifest: {
    web_accessible_resources: [
      {
        resources: ["inject-ikanbot-main-world.js"],
        matches: ["*://www.ikanbot.com/*"],
      },
    ],
  },
});
