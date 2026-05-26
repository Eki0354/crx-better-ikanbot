import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    web_accessible_resources: [{
      resources: ['inject-main-world.js'],
      matches: ['<all_urls>'],
    }],
  },
});
