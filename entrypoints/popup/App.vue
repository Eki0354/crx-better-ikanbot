<script lang="ts" setup>
import { onMessage } from "webext-bridge/popup";
import { useDropboxStore } from "./stores/dropbox";
import { storeToRefs } from "pinia";
import OAuthBox from "@/components/OAuthBox.vue";
import ProgressSync from "@/components/ProgressSync.vue";

const dbStore = useDropboxStore();
const { token } = storeToRefs(dbStore);

// 监听 background 发出的 token 过期通知 → 清除 token
onMessage("token_expired", () => {
  dbStore.clearToken();
});
</script>

<template>
  <OAuthBox v-if="!token" />
  <ProgressSync v-else />
</template>
