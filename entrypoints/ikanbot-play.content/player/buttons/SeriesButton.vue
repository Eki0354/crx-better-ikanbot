<template>
  <BaseActionButton
    data-plyr="series"
    label="剧集"
    @click.prevent.stop="showSeriesSidebar"
  />
</template>

<script setup lang="ts">
import { showSeriesSidebar } from "../../utils";
import BaseActionButton from "./BaseActionButton.vue";
</script>
