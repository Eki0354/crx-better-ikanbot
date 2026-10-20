<template>
  <BaseActionButton
    data-plyr="download"
    :icon="downloadIcon"
    @click.prevent.stop="onDownload"
  />
</template>

<script setup lang="ts">
import { usePlayerStore } from "../store";
import BaseActionButton from "./BaseActionButton.vue";
import { storeToRefs } from "pinia";
import { useToast } from "@lanxuexing/vue2toast";

const downloadIcon = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
)}`;

const playerStore = usePlayerStore();
const { currentSource } = storeToRefs(playerStore);

const toast = useToast();

const onDownload = () => {
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
