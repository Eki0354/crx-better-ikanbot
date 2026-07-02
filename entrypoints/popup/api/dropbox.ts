/**
 * Dropbox API — Popup 端代理
 *
 * 所有实际 HTTP 请求通过 webext-bridge 转发到 background 执行，
 * 以规避 popup 页面的 CORS 限制。
 */
import { sendMessage } from "webext-bridge/popup";
import { readToken } from "@/entrypoints/popup/utils/storage";
import type {
  TokenResponse,
  ListFolderResponse,
  SearchResponse,
} from "@/entrypoints/api/dropbox";

export type { TokenResponse, ListFolderResponse, SearchResponse };

// ---------- 工具 ----------

function requireToken(): string {
  const token = readToken();
  if (!token) throw new Error("Dropbox token 不存在");
  return token;
}

// ---------- OAuth（不需要 token） ----------

export async function fetchToken(code: string): Promise<TokenResponse> {
  return sendMessage("dropbox:fetchToken", { code }, "background") as Promise<TokenResponse>;
}

// ---------- 文件/文件夹操作（需要 token） ----------

export async function sureExist(path: string): Promise<boolean> {
  const token = requireToken();

  try {
    await sendMessage(
      "dropbox:getMetadata",
      { path, token },
      "background",
    );
    return true;
  } catch (error: any) {
    if (error?.error?.path?.[".tag"] === "not_found") {
      // 无扩展名的路径 → 文件夹；否则 → 文件
      if (!path.split("/").pop()?.includes(".")) {
        return sendMessage(
          "dropbox:createFolder",
          { path, token },
          "background",
        )
          .then(() => true)
          .catch(() => false);
      }
      return sendMessage(
        "dropbox:uploadFile",
        { path, content: "", token, mode: "add" },
        "background",
      )
        .then(() => true)
        .catch(() => false);
    }
    return false;
  }
}

export async function uploadFile(
  path: string,
  content: string,
  mode: "add" | "overwrite" = "overwrite",
): Promise<boolean> {
  const token = requireToken();

  return sendMessage(
    "dropbox:uploadFile",
    { path, content, token, mode },
    "background",
  )
    .then(() => true)
    .catch(() => false);
}

export async function searchFiles(
  query: string,
  path?: string,
): Promise<SearchResponse> {
  const token = requireToken();

  return sendMessage(
    "dropbox:searchFiles",
    { query, token, path },
    "background",
  ) as Promise<SearchResponse>;
}

export async function downloadFile(path: string): Promise<string> {
  const token = requireToken();

  return sendMessage(
    "dropbox:downloadFile",
    { path, token },
    "background",
  ) as Promise<string>;
}
