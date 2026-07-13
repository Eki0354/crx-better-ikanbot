export default defineContentScript({
  matches: ["*://www.ikanbot.com/*"],
  main() {
    injectScript("/inject-anti-ads.js");
  },
});
