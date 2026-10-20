<template>
  <BaseActionButton
    data-plyr="autoPlayNext"
    role="menuitemcheckbox"
    :aria-checked="autoplayEnabled"
    @click.prevent.stop="onClick"
  >
    <div class="autoplay-item__inner">
      <span class="plyr__menu__label">自动续播</span>
      <span class="autoplay-switch" :class="{ on: autoplayEnabled }">
        <span class="autoplay-switch__thumb"></span>
      </span>
    </div>
  </BaseActionButton>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePlayerStore } from "../store";
import { playNext } from "../../series/main";
import BaseActionButton from "./BaseActionButton.vue";

const KEY = "autoplay_enabled";

const playerStore = usePlayerStore();
const { player } = storeToRefs(playerStore);

const autoplayEnabled = ref(localStorage.getItem(KEY) === "1");

const toggleAutoplay = () => {
  if (autoplayEnabled.value) {
    player.value?.on("ended", playNext);
  } else {
    player.value?.off("ended", playNext);
  }
};

const onClick = () => {
  const isAutoplay = !autoplayEnabled.value;
  autoplayEnabled.value = isAutoplay;
  localStorage.setItem(KEY, isAutoplay ? "1" : "0");

  nextTick(toggleAutoplay);
};

onMounted(toggleAutoplay);
</script>

<style scoped lang="scss">
/* 模仿 B 站播放器设置项：整行 hover 高亮 + 右侧 switch 开关 */
.autoplay-item {
  border-radius: 6px;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

/* 避免 Plyr 的 `.plyr__control > span { display: flex; width: 100% }` 撑满开关 */
.autoplay-item__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
}

.autoplay-switch {
  position: relative;
  flex-shrink: 0;
  width: 32px;
  height: 16px;
  border-radius: 12px;
  background: #4e5969; /* 关闭：B 站深灰 */
  box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.25);
  transition: background 0.2s ease;

  &.on {
    background: #00AEEC; /* 开启：B 站蓝 */
  }
}

.autoplay-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease;

  .autoplay-switch.on & {
    transform: translateX(16px);
  }
}
</style>
