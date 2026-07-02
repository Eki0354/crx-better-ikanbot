/**
 * Dropbox API — 真实 HTTP 实现（background 中使用）
 */

// ---------- Token 过期错误标记 ----------

/** Dropbox 401 token 相关错误的 .tag 值 */
export const TOKEN_ERROR_TAGS = ["expired_access_token", "invalid_access_token"] as const;

/**
 * 判断 axios 拒绝值是否为 token 过期/无效错误
 * 可在 popup 侧捕获后调用 clearToken() 引导用户重新授权
 */
export function isTokenExpiredError(err: unknown): boolean {
  const data = (err as any)?.error;
  return !!(data && TOKEN_ERROR_TAGS.includes(data[".tag"]));
}

import axios from "axios";
import type { AxiosError, AxiosResponse } from "axios";
import { sendMessage } from "webext-bridge/background";

// ---------- 独立的 axios 实例 ----------

const instance = axios.create({
  baseURL: "https://api.dropboxapi.com",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Content 端点（upload/download）使用独立的域名
const contentInstance = axios.create({
  baseURL: "https://content.dropboxapi.com",
  timeout: 15_000,
  headers: { "Content-Type": "application/octet-stream" },
});

// ---------- 响应拦截器（两个实例共享） ----------

function responseFulfilled(res: AxiosResponse) {
  return res;
}
function responseRejected(err: AxiosError) {
  if (!err.response) {
    console.error("[bg-api] 网络异常或超时:", err.message);
    return Promise.reject(err);
  }

  const { status, data } = err.response;

  // 401 + token 过期/无效 → 通知 popup 清除 token
  if (status === 401) {
    const payload = (data as any)?.error;
    if (payload && TOKEN_ERROR_TAGS.includes(payload[".tag"])) {
      sendMessage("token_expired", {}, "popup").catch(() => {});
      return Promise.reject(data || `请求失败：${status}`);
    }
  }

  return Promise.reject(data || `请求失败：${status}`);
}

instance.interceptors.response.use(responseFulfilled, responseRejected);
contentInstance.interceptors.response.use(responseFulfilled, responseRejected);

// ---------- 类型 ----------

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  [key: string]: unknown;
}

export interface ListFolderResponse {
  entries: unknown[];
  cursor: string;
  has_more: boolean;
}

// ---------- OAuth（不需要 token） ----------

/**
 * 用授权码换取 access_token
 */
export async function fetchToken(code: string): Promise<TokenResponse> {
  const {
    WXT_OAUTH_REDIRECT_URI,
    WXT_DROPBOX_CLIENT_ID,
    WXT_DROPBOX_CLIENT_SECRET,
  } = import.meta.env;

  const params = new URLSearchParams();
  params.append("code", code);
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", WXT_OAUTH_REDIRECT_URI);
  params.append("client_id", WXT_DROPBOX_CLIENT_ID);
  params.append("client_secret", WXT_DROPBOX_CLIENT_SECRET);

  return instance
    .post<TokenResponse>("/oauth2/token", params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    .then((res) => res.data);
}

// ---------- 以下函数需要 token ----------

/**
 * 获取文件/文件夹元数据
 */
export async function getMetadata(
  path: string,
  token: string,
): Promise<ListFolderResponse> {
  return instance
    .post<ListFolderResponse>(
      "/2/files/get_metadata",
      { path },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    .then((res) => res.data);
}

/**
 * 创建文件夹
 */
export async function createFolder(
  path: string,
  token: string,
): Promise<ListFolderResponse> {
  return instance
    .post<ListFolderResponse>(
      "/2/files/create_folder_v2",
      { path },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    .then((res) => res.data);
}

/**
 * 上传/覆盖文件
 */
export async function uploadFile(
  path: string,
  content: string,
  token: string,
  mode: "add" | "overwrite" = "overwrite",
): Promise<unknown> {
  return contentInstance
    .post<unknown>("/2/files/upload", content, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ path, mode }),
      },
    })
    .then((res) => res.data);
}

/**
 * 搜索文件
 */
export interface SearchMatch {
  metadata: {
    metadata: {
      path_lower: string;
      path_display: string;
      name: string;
      id: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SearchResponse {
  matches: SearchMatch[];
  has_more: boolean;
  [key: string]: unknown;
}

export async function searchFiles(
  query: string,
  token: string,
  path?: string,
): Promise<SearchResponse> {
  return instance
    .post<SearchResponse>(
      "/2/files/search_v2",
      { query, path },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    .then((res) => res.data);
}

/**
 * 下载文件/读取文件内容（含 Paper 文档）
 */
export async function downloadFile(
  path: string,
  token: string,
): Promise<string> {
  return contentInstance
    .post<string>("/2/files/download", undefined, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path }),
      },
      responseType: "text",
    })
    .then((res) => res.data);
}
