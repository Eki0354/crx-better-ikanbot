import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  webExt: {
    disabled: true,
  },
  manifest: {
    host_permissions: ["https://api.dropboxapi.com/*"],
    web_accessible_resources: [
      {
        resources: ["inject-ikanbot-main-world.js"],
        matches: ["*://www.ikanbot.com/*"],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
