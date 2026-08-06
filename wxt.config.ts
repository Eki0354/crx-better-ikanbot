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
    build: {
      rollupOptions: {
        // 过滤第三方库（如 @vueuse/core）中位置不当的 #__PURE__ 注释警告：
        // 这类注释仅影响 tree-shaking 优化精度，无害，且 node_modules 源码无法直接修改
        onLog(level, log, handler) {
          if (
            log.code === "INVALID_ANNOTATION" &&
            log.id?.includes("node_modules")
          ) {
            return;
          }
          handler(level, log);
        },
      },
    },
  }),
});
