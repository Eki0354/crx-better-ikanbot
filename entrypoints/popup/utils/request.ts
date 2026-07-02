/**
 * 开箱即用的 axios 请求实例
 *
 * 用法：
 *   import request from "./request";
 *   const data = await request.get("/api/xxx");
 *
 * 或导入单个方法：
 *   import { get, post } from "./request";
 *   const data = await get("/api/xxx", { params: { id: 1 } });
 */
import axios, { AxiosError, type AxiosResponse } from "axios";
import { readToken, clearToken } from "./storage";

// ---------- 实例 ----------

const instance = axios.create({
  baseURL: import.meta.env.WXT_DROPBOX_API_BASE ?? "",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ---------- 拦截器 ----------

/** 请求拦截：自动附带 Dropbox token */
instance.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    // 网络错误 / 超时
    if (!err.response) {
      console.error("[request] 网络异常或超时:", err.message);
      return Promise.reject(err);
    }

    const { status, data } = err.response;

    return Promise.reject(data || `请求失败：${status}`);
  },
);

// ---------- 默认导出 (实例) ----------

export default instance;

// ---------- Token 过期工具（从 background API 层 re-export） ----------

export { clearToken } from "./storage";
export { isTokenExpiredError, TOKEN_ERROR_TAGS } from "@/entrypoints/api/dropbox";
