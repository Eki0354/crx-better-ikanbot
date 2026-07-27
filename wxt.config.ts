import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  webExt: {
    disabled: true,
  },
  manifest: {
    permissions: ["declarativeNetRequestWithHostAccess"],
    host_permissions: [
      "https://api.dropboxapi.com/*",
      "https://*.douban.com/*",
      "https://*.doubanio.com/*",
      "https://imgp.ikanbot.eu.org/*",
    ],
    web_accessible_resources: [
      {
        resources: ["inject-play.js", "inject-anti-ads.js"],
        matches: ["*://www.ikanbot.com/*"],
      },
    ],
  },
  vite: () => ({
    plugins: [
      tailwindcss(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
  }),
});
