import { defineStore } from "pinia";
import { sendMessage } from "webext-bridge/popup";
import {
  fetchToken,
  sureExist,
  uploadFile,
  downloadFile,
} from "@/entrypoints/popup/api/dropbox";
import {
  readToken,
  writeToken,
  clearToken as clearStorageToken,
  readLastUploadTime,
  writeLastUploadTime,
  readLastDownloadTime,
  writeLastDownloadTime,
} from "@/entrypoints/popup/utils/storage";

const REMOTE_PATH = "/playback/progress.paper";

export const useDropboxStore = defineStore("dropbox", () => {
  const token = ref(readToken());
  const inited = ref(false);
  const remoteContent = ref("");
  const lastUploadTime = ref(readLastUploadTime());
  const lastDownloadTime = ref(readLastDownloadTime());

  // ---------- 清除 token（由 App.vue 中 token_expired 消息调用） ----------

  function clearToken() {
    token.value = "";
    inited.value = false;
    clearStorageToken();
  }

  // ---------- 授权 ----------

  async function accessOauth(secret: string) {
    const data = await fetchToken(secret);
    const value = data.access_token || "";
    token.value = value;
    writeToken(value);
  }

  // ---------- 初始化 ----------

  async function init() {
    if (!token.value) return false;

    const isDirExist = await sureExist("/playback");
    if (!isDirExist) return false;

    const isFileExist = await sureExist(REMOTE_PATH);
    if (!isFileExist) return false;

    await syncFromRemote();

    inited.value = true;
    return true;
  }

  // ---------- 云端 → 本地 ----------

  async function syncFromRemote() {
    if (!token.value) return false;

    const content = await downloadFile(REMOTE_PATH);
    remoteContent.value = content;
    sendMessage("sync_progress", content, "background");

    const ts = Date.now();
    lastDownloadTime.value = ts;
    writeLastDownloadTime(ts);
    return true;
  }

  // ---------- 本地 → 云端 ----------

  async function uploadProgress(data: string) {
    if (!token.value || !inited.value) return false;

    const res = await uploadFile(REMOTE_PATH, data, "overwrite");
    if (res) {
      const ts = Date.now();
      lastUploadTime.value = ts;
      writeLastUploadTime(ts);
    }
    return res;
  }

  async function manualUploadToCloud() {
    if (!token.value || !inited.value) return false;

    const tabs = await browser.tabs.query({ url: "*://www.ikanbot.com/*" });
    if (!tabs[0]?.id) return false;

    const data = await sendMessage<string>(
      "get_progress",
      {},
      `content-script@${tabs[0].id}`,
    );
    if (!data) return false;

    const res = await uploadProgress(data);
    return res;
  }

  return {
    token,
    inited,
    remoteContent,
    lastUploadTime,
    lastDownloadTime,
    clearToken,
    accessOauth,
    init,
    syncFromRemote,
    uploadProgress,
    manualUploadToCloud,
  };
});
