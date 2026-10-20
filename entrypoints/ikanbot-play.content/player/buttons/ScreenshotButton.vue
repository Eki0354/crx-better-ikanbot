<template>
  <BaseActionButton
    data-plyr="screenshot"
    role="menuitem"
    label="截图(F10)"
    @click.prevent.stop="onClick"
  />
</template>

<script setup lang="ts">
import { getVideoTitle } from "../../series/main";
import BaseActionButton from "./BaseActionButton.vue";

/** 当前视频画面截图并下载为 PNG */
const takeScreenshot = () => {
  const video: HTMLVideoElement | null = document.querySelector(".plyr video");
  if (!video) return;

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(video, 0, 0, w, h);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ikanbot-screenshot-${getVideoTitle()}-${video.currentTime || "00"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
};

const onClick = () => {
  // 关闭设置菜单
  (
    document.querySelector(
      '.plyr__control[data-plyr="settings"]',
    ) as HTMLElement | null
  )?.click();
  takeScreenshot();
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.code !== 'F10') return;

  onClick();
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>
