import { sendMessage, onMessage } from "webext-bridge/background";
import * as dropboxApi from "@/entrypoints/api/dropbox";

export default defineBackground(() => {
  // 转发 content-script 的 secret 消息到 popup
  onMessage("secret", ({ data, sender }) => {
    browser.tabs.remove(sender.tabId);
    sendMessage("secret", data, "popup");
  });

  // 转发播放进度到 popup
  onMessage("playback_progress", ({ data }) => {
    sendMessage("playback_progress", data, "popup");
  });

  // ------- Dropbox API 代理 -------

  onMessage("dropbox:fetchToken", ({ data }) => {
    const { code } = data as { code: string };
    return dropboxApi.fetchToken(code);
  });

  onMessage("dropbox:getMetadata", ({ data }) => {
    const { path, token } = data as { path: string; token: string };
    return dropboxApi.getMetadata(path, token);
  });

  onMessage("dropbox:createFolder", ({ data }) => {
    const { path, token } = data as { path: string; token: string };
    return dropboxApi.createFolder(path, token);
  });

  onMessage("dropbox:uploadFile", ({ data }) => {
    const { path, content, token, mode } = data as {
      path: string;
      content: string;
      token: string;
      mode?: "add" | "overwrite";
    };
    return dropboxApi.uploadFile(path, content, token, mode);
  });

  onMessage("dropbox:searchFiles", ({ data }) => {
    const { query, token, path } = data as {
      query: string;
      token: string;
      path?: string;
    };
    return dropboxApi.searchFiles(query, token, path);
  });

  onMessage("dropbox:downloadFile", ({ data }) => {
    const { path, token } = data as { path: string; token: string };
    return dropboxApi.downloadFile(path, token);
  });

  // ------- 远程同步：popup → content script -------

  onMessage("sync_progress", ({ data }) => {
    browser.tabs.query({ url: "*://www.ikanbot.com/play/*" }).then((tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          sendMessage("sync_progress", data, `content-script@${tab.id}`);
        }
      }
    });
  });
});
