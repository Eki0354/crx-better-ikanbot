<template>
  <div class="progress-sync">
    <p class="status">播放记录云同步已就绪</p>

    <div class="info-row">
      <span>上次上传：</span>
      <span class="time">{{ formatTime(dbStore.lastUploadTime) || "暂无" }}</span>
    </div>
    <div class="info-row">
      <span>上次下载：</span>
      <span class="time">{{ formatTime(dbStore.lastDownloadTime) || "暂无" }}</span>
    </div>

    <div class="checkbox-row">
      <label>
        <input v-model="autoUpload" type="checkbox" />
        自动上传
      </label>
      <label>
        <input v-model="autoDownload" type="checkbox" />
        自动下载
      </label>
    </div>

    <div class="btn-group">
      <button class="btn" :disabled="!!syncing" @click="onUpload">
        {{ syncing === "upload" ? "上传中..." : "上传到云端" }}
      </button>
      <button class="btn" :disabled="!!syncing" @click="onDownload">
        {{ syncing === "download" ? "下载中..." : "从云端下载" }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMessage } from "webext-bridge/popup";
import { debounce } from "lodash-es";
import { storeToRefs } from "pinia";
import { useDropboxStore } from "../entrypoints/popup/stores/dropbox";
import {
  readAutoUpload,
  writeAutoUpload,
  readAutoDownload,
  writeAutoDownload,
} from "../entrypoints/popup/utils/storage";

const dbStore = useDropboxStore();
const { lastUploadTime, lastDownloadTime } = storeToRefs(dbStore);
const syncing = ref<"upload" | "download" | "">("");

// ---------- 开关（持久化到 localStorage） ----------

const autoUpload = ref(readAutoUpload());
const autoDownload = ref(readAutoDownload());

watch(autoUpload, (v) => writeAutoUpload(v));
watch(autoDownload, (v) => writeAutoDownload(v));

// ---------- 自动上传（来自 content script 的进度） ----------

const debounceUpload = debounce(
  (data: any) => {
    dbStore.uploadProgress(data || "");
  },
  10000,
  { trailing: true, maxWait: 10000 },
);

onMessage("playback_progress", ({ data }: any) => {
  if (autoUpload.value) {
    debounceUpload(data || "");
  }
});

// ---------- 手工上传 ----------

async function onUpload() {
  syncing.value = "upload";
  await dbStore.manualUploadToCloud();
  syncing.value = "";
}

// ---------- 手工下载 ----------

async function onDownload() {
  syncing.value = "download";
  await dbStore.syncFromRemote();
  syncing.value = "";
}

// ---------- 10 分钟自动轮询下载 ----------

let timer: ReturnType<typeof setInterval> | null = null;

function startAutoDownload() {
  stopAutoDownload();
  timer = setInterval(() => {
    dbStore.syncFromRemote();
  }, 10 * 60 * 1000);
}

function stopAutoDownload() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(autoDownload, (v) => {
  if (v) startAutoDownload();
  else stopAutoDownload();
});

onMounted(() => {
  dbStore.init();
  if (autoDownload.value) startAutoDownload();
});

onUnmounted(() => {
  stopAutoDownload();
});

// ---------- 格式化 ----------

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
</script>

<style scoped>
.progress-sync {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  min-width: 220px;
}
.status {
  font-size: 14px;
  font-weight: 600;
  color: #4caf50;
}
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #666;
}
.time {
  color: #333;
  font-variant-numeric: tabular-nums;
}
.checkbox-row {
  display: flex;
  gap: 16px;
  font-size: 13px;
}
.checkbox-row label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #555;
}
.checkbox-row input {
  margin: 0;
}
.btn-group {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) {
  background: #f0f0f0;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
