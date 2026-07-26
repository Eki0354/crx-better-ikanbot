<template>
  <button class="btn-collapse" title="收起侧边栏" @click="hideSeriesSidebar">
    ◀
  </button>

  <Teleport to="body">
    <button class="btn-expand" title="展开侧边栏" @click="showSeriesSidebar">
      ▶
    </button>
  </Teleport>
</template>

<script setup lang="ts">
const sidebar = document.querySelector(
  ".row:has(#playList)",
) as HTMLDivElement | null;

function showSeriesSidebar() {
  if (!sidebar) return;

  sidebar.style.display = "flex";

  if (!("scrolled" in sidebar.dataset)) {
    // 将当前剧集选项滚动到当前视区
    document
      .querySelector('#lineContent [name="lineData"].active')
      ?.scrollIntoView();
    sidebar.dataset["scrolled"] = "1";
  }
}

function hideSeriesSidebar() {
  if (!sidebar) return;

  sidebar.style.display = "none";
}
</script>

<style lang="scss" scoped>
.btn-collapse {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  cursor: pointer;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
  line-height: 1;
  color: #666;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
  }
}

.btn-expand {
  display: block;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1;
  cursor: pointer;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0 4px 4px 0;
  padding: 6px 8px;
  font-size: 14px;
  line-height: 1;
  color: #666;
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.1);
  transition: background 0.2s;

  &:hover {
    background: #fff;
  }
}
</style>
