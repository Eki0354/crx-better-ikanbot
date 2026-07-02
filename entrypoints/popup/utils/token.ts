export const KEY_TOKEN = "__dropbox_token__";

export function readToken() {
  return localStorage.getItem(KEY_TOKEN) || "";
}

export function writeToken(token: string = "") {
  localStorage.setItem(KEY_TOKEN, token);
}
