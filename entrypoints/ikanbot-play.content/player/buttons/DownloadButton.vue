<template>
  <BaseActionButton
    data-plyr="download"
    :icon="downloadIcon"
    @click.prevent.stop="onTogglePanel"
  />

  <div v-if="panelVisible" class="plyr__download-panel" @click.stop>
    <div class="plyr__download-panel-header">
      <span class="plyr__download-panel-title">{{ panelTitle }}</span>
      <button class="plyr__download-panel-close" @click="panelVisible = false">
        &times;
      </button>
    </div>

    <div class="plyr__download-progress-wrap">
      <div class="plyr__download-progress-bar">
        <div
          class="plyr__download-progress-fill"
          :class="{
            done: downloadState.status === 'done',
            error: downloadState.status === 'error',
          }"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
    </div>

    <div class="plyr__download-info">
      <span class="left">
        <span class="plyr__download-size">{{ sizeText }}</span>
        <span class="plyr__download-speed">{{ speedText }}</span>
      </span>
      <span class="right">
        <span class="plyr__download-eta">{{ etaText }}</span>
      </span>
    </div>

    <div class="plyr__download-extra-msg">
      <div v-if="downloadState.status === 'error'" class="plyr__download-error">
        {{ downloadState.error }}
      </div>
      <div
        v-else-if="downloadState.status === 'done'"
        class="plyr__download-done-msg"
      >
        文件已保存，点击关闭按钮
      </div>
    </div>

    <div class="plyr__download-panel-footer">
      <template
        v-if="
          downloadState.status === 'idle' ||
          downloadState.status === 'preparing'
        "
      >
        <button
          class="plyr__download-btn plyr__download-btn--primary"
          :disabled="downloadState.status === 'preparing'"
          @click="prepareDownload"
        >
          {{ downloadState.status === "preparing" ? "准备中..." : "开始下载" }}
        </button>
      </template>
      <template v-else-if="downloadState.status === 'downloading'">
        <button
          class="plyr__download-btn plyr__download-btn--warning"
          @click="pauseDownload"
        >
          暂停
        </button>
      </template>
      <template v-else-if="downloadState.status === 'paused'">
        <button
          class="plyr__download-btn plyr__download-btn--success"
          @click="resumeDownload"
        >
          继续
        </button>
        <button
          class="plyr__download-btn"
          @click="
            resetState();
            panelVisible = false;
          "
        >
          取消
        </button>
      </template>
      <template v-else-if="downloadState.status === 'done'">
        <button
          class="plyr__download-btn plyr__download-btn--primary"
          @click="panelVisible = false"
        >
          关闭
        </button>
      </template>
      <template v-else-if="downloadState.status === 'error'">
        <button
          class="plyr__download-btn plyr__download-btn--danger"
          @click="prepareDownload"
        >
          重试
        </button>
        <button class="plyr__download-btn" @click="panelVisible = false">
          关闭
        </button>
      </template>
    </div>

    <div class="plyr__download-copy-link">
      <span :class="{ copied: copied }" @click="copyM3U8">
        {{ copied ? "已复制" : "复制 m3u8 链接" }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from "../store";
import BaseActionButton from "./BaseActionButton.vue";
import {
  downloadState,
  downloadIcon,
  formatSpeed,
  formatEta,
  prepareDownload,
  pauseDownload,
  resumeDownload,
  resetState,
  startDownloadLoop,
  stopDownloadLoop,
  fragTimestamps,
} from "./download";

const panelVisible = ref(false);
const copied = ref(false);
let copyTimer = 0;

const total = computed(() => downloadState.urls.length);
const done = computed(() =>
  Math.min(downloadState.completedCount, total.value),
);

const progressPercent = computed(() =>
  total.value > 0 ? (done.value / total.value) * 100 : 0,
);

const sizeText = computed(() =>
  total.value > 0 ? `第 ${done.value}/${total.value} 个片段` : "",
);

const speedText = computed(() => formatSpeed(downloadState.speed));

const etaText = computed(() => {
  if (done.value <= 0 || total.value <= done.value) return "";
  const now = Date.now();
  const recent = fragTimestamps.filter((t) => t >= now - 5000);
  const c = recent.length;
  if (c === 0) return "";
  const e = (recent[c - 1] - recent[0]) / 1000 || 1;
  const est = (total.value - done.value) / (c / e);
  return est > 0 ? formatEta(est) : "";
});

const panelTitle = computed(() =>
  downloadState.status === "done"
    ? "下载完成"
    : downloadState.status === "error"
      ? "下载失败"
      : "下载视频",
);

const onTogglePanel = () => {
  panelVisible.value = !panelVisible.value;
};

const copyM3U8 = async () => {
  const { currentSource } = usePlayerStore();
  const url = currentSource || "";
  if (!url) return;

  const showCopied = () => {
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => (copied.value = false), 2000);
  };

  try {
    await navigator.clipboard.writeText(url);
    showCopied();
  } catch {
    // 降级方案
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showCopied();
  }
};

// 点击外部关闭弹窗
const onDocumentClick = (e: MouseEvent) => {
  if (!panelVisible.value) return;
  const target = e.target as HTMLElement;
  if (
    target.closest(".plyr__download-panel") ||
    target.closest(".plyr__control--download")
  ) {
    return;
  }
  panelVisible.value = false;
};

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  startDownloadLoop();

  // 弹窗以 .plyr__controls 为锚点（bottom: 100%），需要非 static 定位
  const controls = document.querySelector(
    ".plyr__controls",
  ) as HTMLElement | null;
  if (controls && getComputedStyle(controls).position === "static") {
    controls.style.position = "relative";
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  stopDownloadLoop();
  clearTimeout(copyTimer);
});
</script>

<style scoped lang="scss">
.plyr__control--download {
  order: 9;
}

.plyr__download-panel {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 10px;
  background: rgba(0, 0, 0, 0.88);
  border-radius: 8px;
  padding: 14px 16px;
  min-width: 300px;
  color: #fff;
  font-size: 13px;
  backdrop-filter: blur(10px);
  z-index: 1000;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.plyr__download-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 14px;
}

.plyr__download-panel-close {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;

  &:hover {
    color: #fff;
  }
}

.plyr__download-progress-wrap {
  margin-bottom: 8px;
}

.plyr__download-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  overflow: hidden;
}

.plyr__download-progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #00b3ff, #0066ff);
  border-radius: 3px;
  transition: width 0.3s ease;

  &.done {
    background: linear-gradient(90deg, #00cc66, #00994d);
  }

  &.error {
    background: linear-gradient(90deg, #ff4444, #cc0000);
  }
}

.plyr__download-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #bbb;
  flex-wrap: wrap;
  min-height: 18px;

  .left,
  .right {
    display: flex;
    gap: 12px;
  }
}

.plyr__download-panel-footer {
  margin-top: 10px;
  display: flex;
  gap: 8px;

  .spacer {
    flex: 1;
  }
}

.plyr__download-btn {
  padding: 7px 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &--primary {
    background: #0066ff;
    border-color: #0066ff;

    &:hover {
      background: #0052cc;
    }
  }

  &--warning {
    background: #ff8c00;
    border-color: #ff8c00;

    &:hover {
      background: #cc7000;
    }
  }

  &--success {
    background: #00b341;
    border-color: #00b341;

    &:hover {
      background: #009933;
    }
  }

  &--danger {
    background: #e53935;
    border-color: #e53935;

    &:hover {
      background: #b71c1c;
    }
  }
}

.plyr__download-error {
  color: #ff6666;
  font-size: 12px;
  margin-top: 4px;
}

.plyr__download-done-msg {
  color: #66cc88;
  font-size: 12px;
  margin-top: 4px;
}

.plyr__download-copy-link {
  margin-top: 8px;
  font-size: 12px;

  span {
    color: #888;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.15s;

    &:hover {
      color: #fff;
    }

    &.copied {
      color: #66cc88;
    }
  }
}
</style>
