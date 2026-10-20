<template>
  <Teleport to="#player-wrap">
    <video ref="videoRef" style="aspect-ratio: 16/9"></video>
  </Teleport>

  <Teleport v-if="isReady" to=".plyr__controls">
    <PrevButton v-if="hasPrevSeries" v-first />
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
import PrevButton from "./buttons/PrevButton.vue";
import { vFirst } from "~/directives/vFirst";
import { useKeepLast } from "@/hooks/useKeepLast";

const playerStore = usePlayerStore();

const { isReady, hasPrevSeries } = storeToRefs(playerStore);

useKeepLast({
  parent: ".plyr__controls",
  child: ".plyr__controls__item[data-plyr='fullscreen']",
});

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
      &[data-plyr="prev"] {
        order: 10;
      }

      &[data-plyr="play"] {
        order: 20;
      }

      &[data-plyr="next"] {
        order: 30;
      }

      &[data-plyr="series"] {
        order: 40;
      }

      &.plyr__progress__container {
        order: 50;
      }

      &[aria-label="Current time"] {
        order: 60;
      }

      &[aria-label="Duration"] {
        order: 70;
      }

      &.plyr__volume {
        order: 80;
      }

      &.plyr__menu {
        order: 90;
      }

      &[data-plyr="download"] {
        order: 100;
      }

      &[data-plyr="immersive"] {
        order: 110;
      }

      &[data-plyr="fullscreen"] {
        order: 120;
      }
    }
  }
}
</style>
