import "./dropbox.css";
import { sendMessage } from "webext-bridge/content-script";

export default defineContentScript({
  matches: ["*://www.ikanbot.com/oauth/*"],
  runAt: "document_start",
  main(ctx) {
    console.log("OAuth content script loaded", ctx);
    window.addEventListener("load", () => {
      console.log("OAuth content script running after page load");
      const params = new URLSearchParams(window.location.search);
      const secret = params.get("code") || "";

      if (secret) {
        document.body.innerHTML = "<h1>授权成功</h1>";
        sendMessage("secret", { secret }, "background");
      } else {
        const error = params.get("error") || "未知错误";
        const errorDescription =
          params.get("error_description") || "未知错误描述";
        document.body.innerHTML = `<h1>授权失败</h1><p>${error}: ${errorDescription}</p>`;
      }
    });
  },
});
