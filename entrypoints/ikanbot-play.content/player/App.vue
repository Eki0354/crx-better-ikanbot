<template>
  <Teleport to="#player-wrap">
    <video ref="videoRef" style="aspect-ratio: 16/9"></video>
  </Teleport>
</template>

<script setup lang="ts">
import { usePlayerStore } from "./store";

const playerStore = usePlayerStore();

const videoRef = ref<HTMLVideoElement | null>(null);

onMounted(() => {
  if (!videoRef.value) return;

  playerStore.init(videoRef.value);

  // 清除祖先节点class，避免影响播放器样式
  document.querySelector("#pc-player")?.setAttribute("class", "");

  window.postMessage({ type: "DISPOSE_SOURCE_VIDEO" }, "/");
});
</script>

<style lang="scss">
/* 直接引入 Plyr 官方样式 */
@import "plyr/dist/plyr.css";

body.no-scroll {
  overflow: hidden !important;
  padding: 0 !important;
}

#player-wrap {
  > .video-js {
    display: none;
  }
}
</style>
