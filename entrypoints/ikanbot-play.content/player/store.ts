import { defineStore } from "pinia";
import Hls from "hls.js";
import Plyr from "plyr";
import { readVideoProgress, saveVideoProgress } from "./progress";
import { getVideoM3U8, hasPreviewSeries } from "../series/main";

export const usePlayerStore = defineStore("player", () => {
  const hls = ref<Hls | null>(null);
  const player = ref<Plyr | null>(null);
  const currentSource = ref("");
  const isReady = ref(false);
  const hasPrevSeries = ref(hasPreviewSeries());

  const playSource = (source: string) => {
    hls.value?.loadSource(source);
    currentSource.value = source;
    player.value?.play();
    hasPrevSeries.value = hasPreviewSeries();
  };

  const getVideoProgress = () =>
    (currentSource.value &&
      player.value &&
      readVideoProgress(currentSource.value)) ??
    null;

  const init = (video: HTMLVideoElement, isInitial = true) => {
    const source = getVideoM3U8();
    if (!source) return null;

    const playerInstance = new Plyr(video, {
      keyboard: {
        global: true,
      },
      tooltips: { controls: true },
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "settings",
        "fullscreen",
      ],
      i18n: {
        play: "播放",
        pause: "暂停",
        mute: "静音(m)",
        unmute: "取消静音(m)",
        enterFullscreen: "进入全屏(f)",
        exitFullscreen: "退出全屏(f)",
        settings: "设置",
        download: "下载",
        prev: '上一集([)',
        next: "下一集(])",
        speed: "速度",
        normal: "1.0x",
        enterImmersive: "网页全屏",
        exitImmersive: "退出网页全屏",
      },
    });

    let hasInited = false;

    playerInstance.on("canplay", () => {
      if (hasInited) return;
      hasInited = true;

      const progress = getVideoProgress();
      if (progress) {
        playerInstance.currentTime = progress.time;
      }

      if (!isInitial) {
        playerInstance.play();
      }
    });

    playerInstance.on("ready", () => (isReady.value = true));

    playerInstance.on("timeupdate", saveVideoProgress);

    if (!Hls.isSupported()) return;

    // 初始化 Hls.js 并关联视频
    const hlsInstance = new Hls();
    hlsInstance.loadSource(source);
    hlsInstance.attachMedia(video);

    currentSource.value = source;
    hls.value = hlsInstance;
    player.value = playerInstance;

    return { hls: hlsInstance, player: playerInstance, source };
  };

  return {
    player,
    currentSource,
    hls,
    isReady,
    hasPrevSeries,
    init,
    playSource,
  };
});
