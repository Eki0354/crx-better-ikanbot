<template>
  <Teleport to="#player-wrap">
    <video ref="videoRef" style="aspect-ratio: 16/9"></video>
  </Teleport>

  <Teleport v-if="isReady" to=".plyr__controls">
    <NextButton />
    <SeriesButton />
    <ImmersiveButton />
    <DownloadButton />
  </Teleport>

  <Teleport v-if="isReady" to=".plyr__menu__container [role='menu']">
    <ScreenshotButton />
    <AutoplayButton />
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePlayerStore } from "./store";
import NextButton from "./buttons/NextButton.vue";
import SeriesButton from "./buttons/SeriesButton.vue";
import ImmersiveButton from "./buttons/ImmersiveButton.vue";
import DownloadButton from "./buttons/DownloadButton.vue";
import ScreenshotButton from "./buttons/ScreenshotButton.vue";
import AutoplayButton from "./buttons/AutoplayButton.vue";

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
      &[data-plyr="play"] {
        order: 1;
      }

      &[data-plyr="next"] {
        order: 2;
      }

      &[data-plyr="series"] {
        order: 3;
      }

      &.plyr__progress__container {
        order: 4;
      }

      &[aria-label="Current time"] {
        order: 5;
      }

      &[aria-label="Duration"] {
        order: 6;
      }

      &.plyr__volume {
        order: 7;
      }

      &.plyr__menu {
        order: 8;
      }

      &[data-plyr="download"] {
        order: 9;
      }

      &[data-plyr="immersive"] {
        order: 10;
      }

      &[data-plyr="fullscreen"] {
        order: 11;
      }
    }
  }
}
</style>
