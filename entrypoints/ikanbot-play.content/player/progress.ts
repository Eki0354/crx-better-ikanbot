import { onMessage, sendMessage } from "webext-bridge/content-script";
import debounce from "lodash-es/debounce";
import { getVideoM3U8 } from "../series";

const KEY_PLAYBACK_PROGRESS = "playback_progress";

type PlaybackProgress = {
  url: string;
  time: number;
};

// 监听远程同步：从 Dropbox 拉取的数据写回本地
onMessage("sync_progress", ({ data }) => {
  const payload = data as string;
  if (payload) {
    localStorage.setItem(KEY_PLAYBACK_PROGRESS, payload);
  }
});

// 监听获取当前进度请求：popup 手动上传时调用
onMessage("get_progress", () => {
  return localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "";
});

export const getCurrentTime = () =>
  (document.querySelector("#player-wrap video") as HTMLVideoElement | null)
    ?.currentTime || 0;

export const readVideoProgress = (
  currentSource: string,
): PlaybackProgress | null => {
  const list = JSON.parse(
    localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
  ) as PlaybackProgress[];
  return list.find((item) => item.url === currentSource) || null;
};

export const saveVideoProgress = debounce(
  () => {
    const source = getVideoM3U8();
    const currentTime = getCurrentTime();
    if (!source || currentTime === null) return;

    const list = JSON.parse(
      localStorage.getItem(KEY_PLAYBACK_PROGRESS) || "[]",
    ) as PlaybackProgress[];
    const existingIndex = list.findIndex((item) => item.url === source);

    const newProgress: PlaybackProgress = {
      url: source,
      time: currentTime,
    };

    if (existingIndex >= 0) {
      list[existingIndex] = newProgress;
    } else {
      list.push(newProgress);
    }

    const str = JSON.stringify(list);
    localStorage.setItem(KEY_PLAYBACK_PROGRESS, str);
    sendMessage("playback_progress", str, "background");
  },
  1000,
  { trailing: true, maxWait: 1000 },
);
