<template>
  <button
    class="plyr__control"
    :class="role || 'plyr__controls__item'"
    :data-plyr="dataPlyr"
    type="button"
    :aria-label="tooltip || dataPlyr"
    :role="role"
  >
    <slot>
      <img v-if="icon" class="aspect-square" :src="icon" style="width: 18px" />
      <span v-else-if="label">{{ label }}</span>
    </slot>

    <span v-if="!role && tooltip" class="plyr__tooltip">{{ tooltip }}</span>
  </button>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePlayerStore } from "../store";

type BaseButtonProps = {
  dataPlyr: string;
  label?: string;
  icon?: string;
  tooltipKey?: string;
  role?: "menuitemcheckbox" | "menuitem";
};

const props = defineProps<BaseButtonProps>();

const playerStore = usePlayerStore();
const { player } = storeToRefs(playerStore);

const tooltip = computed(
  () =>
    (player.value as any)?.config?.i18n?.[props.tooltipKey || props.dataPlyr],
);
</script>
