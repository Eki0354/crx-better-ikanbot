<template>
  <button
    class="plyr__control plyr__control--custom plyr__control--series"
    data-plyr="series"
    data-plyr-tooltip="剧集"
    data-plyr-tooltip-persistent="false"
    aria-label="剧集"
    @click.prevent.stop="showSeriesSidebar"
  >
    剧集
  </button>
</template>

<script setup lang="ts">
import { showSeriesSidebar } from "../../utils";
</script>

<style scoped lang="scss">
.plyr__control--series {
  order: 3;
}
</style>
