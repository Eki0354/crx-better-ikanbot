<script lang="ts" setup>
import { ref } from "vue";
import { onMessage } from "webext-bridge/popup";
import { useDropboxStore } from "./stores/dropbox";
import { storeToRefs } from "pinia";
import OAuthBox from "@/components/OAuthBox.vue";
import ProgressSync from "@/components/ProgressSync.vue";
import logoSvg from "../../assets/logo.svg";
import searchPng from "../../assets/search.png";

const dbStore = useDropboxStore();
const { token } = storeToRefs(dbStore);

const keyword = ref("");

// 监听 background 发出的 token 过期通知 → 清除 token
onMessage("token_expired", () => {
  dbStore.clearToken();
});

function goHome() {
  browser.tabs.create({ url: "https://www.ikanbot.com" });
}

function doSearch() {
  const q = encodeURIComponent(keyword.value);
  if (!q) return;

  browser.tabs.create({ url: `https://www.ikanbot.com/search?q=${q}` });
}
</script>

<template>
  <div class="main-container">
    <header class="header">
      <button class="header-btn" @click="goHome" title="ikanbot 首页">
        <img :src="logoSvg" alt="Logo" class="header-icon" />
      </button>
      <input
        v-model="keyword"
        type="text"
        class="search-input"
        placeholder="搜索..."
        @keyup.enter="doSearch"
      />
      <button
        class="header-btn"
        :style="{ cursor: keyword ? 'auto' : 'not-allowed' }"
        :disabled="!keyword"
        @click="doSearch"
        title="搜索"
      >
        <img :src="searchPng" alt="搜索" class="header-icon" />
      </button>
    </header>

    <OAuthBox v-if="!token" />
    <ProgressSync v-else />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 16px;
}
.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.header-btn:hover {
  background: #f0f0f0;
}
.header-icon {
  width: 24px;
  height: 24px;
}
.search-input {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  min-width: 0;
}
.search-input:focus {
  border-color: #646cff;
}
</style>
