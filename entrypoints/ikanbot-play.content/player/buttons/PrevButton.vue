<template>
  <BaseActionButton
    data-plyr="prev"
    :icon="nextIcon"
    @click.prevent.stop="playPrev"
  >
    <img
      class="aspect-square -scale-x-100"
      :src="nextIcon"
      style="width: 18px"
    />
  </BaseActionButton>
</template>

<script setup lang="ts">
import nextIcon from "~/assets/next.png";
import { playPrev } from "../../series/main";
import BaseActionButton from "./BaseActionButton.vue";
import { useBindGlobalKey } from "@/hooks/useBindGlobalKey";

useBindGlobalKey('BracketLeft', playPrev);
</script>
