<template>
  <div ref="handleRef" class="resize-handle" @mousedown="onMouseDown"></div>
</template>

<script setup lang="ts">
const SIDEBAR_WIDTH_KEY = "betterIkanbot_sidebarWidth";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH_RATIO = 0.5;

const handleRef = ref<HTMLDivElement>();

const isDragging = ref(false);

const sidebar = document.querySelector(
  ".row:has(#playList)",
) as HTMLDivElement | null;

const onMouseDown = (e: MouseEvent) => {
  e.preventDefault();
  isDragging.value = true;
  handleRef.value?.classList.add("is-dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
};

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  let newWidth = e.clientX;
  newWidth = Math.max(newWidth, SIDEBAR_MIN_WIDTH);
  newWidth = Math.min(newWidth, window.innerWidth * SIDEBAR_MAX_WIDTH_RATIO);

  if (!sidebar) return;
  sidebar.style.width = newWidth + "px";
};

const onMouseUp = () => {
  if (!isDragging.value) return;
  // isDragging = false;
  handleRef.value?.classList.remove("is-dragging");
  document.body.style.cursor = "";
  document.body.style.userSelect = "";

  if (!sidebar) return;

  // 保存宽度
  const w = sidebar.style.width;
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
};

// 点击侧边栏外部自动收起
const onOutsideClick = (e: MouseEvent) => {
  // mouseup必须先于本事件触发，所以状态在这里进行改变
  if (isDragging.value) {
    isDragging.value = false;
    return;
  }

  const node: HTMLDivElement | null = document.querySelector(
    ".row:has(#playList)",
  );
  if (!node || !node.style.display || node.style.display === "none") return;
  if (node.contains(e.target as Node)) return;

  e.preventDefault();
  e.stopPropagation();

  node.style.display = "none";
};

onMounted(() => {
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp, true);
  window.addEventListener("click", onOutsideClick, true);

  if (!handleRef.value || !sidebar) return;

  // 加载保存的宽度
  const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (savedWidth) {
    const w = parseInt(savedWidth, 10);
    if (
      w >= SIDEBAR_MIN_WIDTH &&
      w <= window.innerWidth * SIDEBAR_MAX_WIDTH_RATIO
    ) {
      sidebar.style.width = w + "px";
    }
  }
});

onUnmounted(() => {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("click", onOutsideClick);
});
</script>

<style lang="scss" scoped>
.resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 10px;
  height: 100%;
  cursor: col-resize;
  z-index: 3;
  background: transparent;
  transition: background 0.2s;

  &:hover,
  &.is-dragging {
    background: rgba(0, 0, 0, 0.06);

    &::after {
      background: rgba(0, 0, 0, 0.35);
      height: 48px;
    }
  }

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 32px;
    border-radius: 1px;
    background: rgba(0, 0, 0, 0.15);
    transition:
      background 0.2s,
      height 0.2s;
  }
}
</style>
