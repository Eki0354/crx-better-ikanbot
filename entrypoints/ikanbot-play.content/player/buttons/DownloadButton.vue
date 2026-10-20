<template>
  <BaseActionButton
    data-plyr="download"
    role="menuitem"
    label="下载"
    @click.prevent.stop="onDownload"
  />
</template>

<script setup lang="ts">
import { usePlayerStore } from "../store";
import BaseActionButton from "./BaseActionButton.vue";
import { storeToRefs } from "pinia";
import { useToast } from "@lanxuexing/vue2toast";

const playerStore = usePlayerStore();
const { currentSource } = storeToRefs(playerStore);

const toast = useToast();

const onDownload = () => {
  // 关闭设置菜单
  (
    document.querySelector(
      '.plyr__control[data-plyr="settings"]',
    ) as HTMLElement | null
  )?.click();

  if (!currentSource.value) {
    toast("未获取到正确的下载链接！", {
      style: {
        backgroundColor: "#E11A45",
        color: "#fff",
      },
    });
    return;
  }

  const downloadURL = `https://blog.luckly-mjw.cn/tool-show/m3u8-downloader/index.html?source=${currentSource.value}`;

  window.open(downloadURL, "_blank");
};
</script>
