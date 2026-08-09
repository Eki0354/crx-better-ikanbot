<template>
  <button
    class="plyr__control plyr__control--custom plyr__control--next-episode"
    data-plyr="data-plyr"
    data-plyr-tooltip="下一集"
    data-plyr-tooltip-persistent="false"
    aria-label="下一集"
    @click.prevent.stop="playNext"
  >
    <img
      :src="nextIcon"
      alt="下一集"
      style="width: 18px; aspect-ratio: square"
    />
  </button>
</template>

<script setup lang="ts">
import nextIcon from "~/assets/next.png";
import { playNext } from "../../series/main";
</script>

<style scoped lang="scss">
.plyr__control--next-episode {
  order: 2;
}
</style>
