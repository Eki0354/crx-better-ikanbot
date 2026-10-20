<template>
  <BaseActionButton
    data-plyr="series"
    :icon="seriesIcon"
    @click.prevent.stop="toggleSeriesSidebar"
  />
</template>

<script setup lang="ts">
import seriesIcon from "~/assets/series.png";
import { toggleSeriesSidebar } from "../../utils";
import BaseActionButton from "./BaseActionButton.vue";
import { useBindGlobalKey } from "@/hooks/useBindGlobalKey";

useBindGlobalKey("KeyS", toggleSeriesSidebar);
</script>
