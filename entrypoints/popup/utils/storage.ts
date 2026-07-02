// ---------- Dropbox token ----------

const KEY_TOKEN = "__dropbox_token__";

export function readToken(): string {
  return localStorage.getItem(KEY_TOKEN) || "";
}

export function writeToken(token: string = "") {
  localStorage.setItem(KEY_TOKEN, token);
}

/** 清除 token（token 过期/无效时调用，引导用户重新授权） */
export function clearToken() {
  localStorage.removeItem(KEY_TOKEN);
}

// ---------- 同步时间戳 ----------

const KEY_UPLOAD_TIME = "__last_upload_time__";
const KEY_DOWNLOAD_TIME = "__last_download_time__";

export function readLastUploadTime(): number {
  return Number(localStorage.getItem(KEY_UPLOAD_TIME) || "0");
}

export function writeLastUploadTime(ts: number) {
  localStorage.setItem(KEY_UPLOAD_TIME, String(ts));
}

export function readLastDownloadTime(): number {
  return Number(localStorage.getItem(KEY_DOWNLOAD_TIME) || "0");
}

export function writeLastDownloadTime(ts: number) {
  localStorage.setItem(KEY_DOWNLOAD_TIME, String(ts));
}

// ---------- 开关设置 ----------

const KEY_AUTO_UPLOAD = "__auto_upload__";
const KEY_AUTO_DOWNLOAD = "__auto_download__";

export function readAutoUpload(): boolean {
  return localStorage.getItem(KEY_AUTO_UPLOAD) !== "false";
}

export function writeAutoUpload(val: boolean) {
  localStorage.setItem(KEY_AUTO_UPLOAD, String(val));
}

export function readAutoDownload(): boolean {
  return localStorage.getItem(KEY_AUTO_DOWNLOAD) !== "false";
}

export function writeAutoDownload(val: boolean) {
  localStorage.setItem(KEY_AUTO_DOWNLOAD, String(val));
}
