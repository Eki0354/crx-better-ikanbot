<template>
  <BaseActionButton
    data-plyr="next"
    :icon="nextIcon"
    @click.prevent.stop="playNext"
  />
</template>

<script setup lang="ts">
import nextIcon from "~/assets/next.png";
import { playNext } from "../../series/main";
import BaseActionButton from "./BaseActionButton.vue";
import { useBindGlobalKey } from "@/hooks/useBindGlobalKey";

useBindGlobalKey('BracketRight', playNext);
</script>
