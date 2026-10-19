<template>
  <BaseActionButton
    data-plyr="immersive"
    :icon="immersiveIcon"
    :tooltip-key="immActive ? 'exitImmersive' : 'enterImmersive'"
    @click.prevent.stop="toggle"
  />
</template>

<script setup lang="ts">
import immersiveIcon from "~/assets/immersive.png";
import BaseActionButton from "./BaseActionButton.vue";

const immActive = ref(false);

const toggle = () => {
  const plyrEl = document.querySelector(".plyr") as HTMLElement | null;
  if (!plyrEl) return;

  if (!immActive.value) {
    plyrEl.classList.add("immersive-mode");
    plyrEl.style.position = "fixed";
    plyrEl.style.top = "0";
    plyrEl.style.left = "0";
    plyrEl.style.width = "100vw";
    plyrEl.style.height = "100vh";
    plyrEl.style.zIndex = "9999";
    document.body.classList.add("no-scroll");
    immActive.value = true;
  } else {
    plyrEl.classList.remove("immersive-mode");
    plyrEl.style.position = "";
    plyrEl.style.top = "";
    plyrEl.style.left = "";
    plyrEl.style.width = "";
    plyrEl.style.height = "";
    plyrEl.style.zIndex = "";
    document.body.classList.remove("no-scroll");
    immActive.value = false;
    window.dispatchEvent(new Event("resize"));
  }
};

// esc 退出沉浸模式
const escHandler = (e: KeyboardEvent) => {
  if (e.key === "Escape" && immActive.value) toggle();
};

onMounted(() => window.addEventListener("keydown", escHandler));
onBeforeUnmount(() => window.removeEventListener("keydown", escHandler));
</script>

<style scoped lang="scss">
.plyr__control--immersive {
  order: 10;
}
</style>
