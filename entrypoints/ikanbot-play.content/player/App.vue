<template>
  <Teleport to="#player-wrap">
    <video ref="videoRef" style="aspect-ratio: 16/9"></video>
  </Teleport>

  <template v-if="isReady">
    <NextButton />
  </template>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePlayerStore } from "./store";
import NextButton from "./buttons/NextButton.vue";

const playerStore = usePlayerStore();

const { isReady } = storeToRefs(playerStore);

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

  .plyr__controls {
    .plyr__controls__item {
      &:nth-child(1) {
        order: 1;
      }

      &:nth-child(2) {
        order: 4;
      }

      &:nth-child(3) {
        order: 4;
      }

      &:nth-child(4) {
        order: 4;
      }

      &:nth-child(5) {
        order: 4;
      }

      &:nth-child(6) {
        order: 4;
      }

      &:nth-child(7) {
        order: 4;
      }
    }
  }
}
</style>
