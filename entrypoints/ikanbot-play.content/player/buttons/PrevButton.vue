<template>
  <BaseActionButton
    data-plyr="prev"
    :icon="nextIcon"
    @click.prevent.stop="playPrev"
  />
</template>

<script setup lang="ts">
import nextIcon from "~/assets/next.png";
import { playPrev } from "../../series/main";
import BaseActionButton from "./BaseActionButton.vue";
</script>
