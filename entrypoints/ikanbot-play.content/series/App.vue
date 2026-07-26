<template>
  <SidebarActions />

  <Teleport to=".row:has(#playList)">
    <VerifyBtn />

    <ResizeHandle />
  </Teleport>

  <Teleport to=".row:has(#playList) .result-info .meta.title">
    <DoubanContent />
  </Teleport>
</template>

<script setup lang="ts">
import DoubanContent from "./DoubanContent.vue";
import ResizeHandle from "./ResizeHandle.vue";
import SidebarActions from "./SidebarActions.vue";
import VerifyBtn from "./VerifyBtn.vue";
</script>

<style lang="scss">
.container-collapse {
  position: absolute;
  right: 0;
  top: 0;
}

.row:has(#playList) {
  position: fixed;
  left: 0;
  top: 0;
  width: 320px;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fff;
  display: flex;
  flex-direction: column-reverse;
  gap: 12px;
  padding: 10px 12px;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.12);
  z-index: 10001;
  display: none;

  > div:first-child {
    width: 100%;
    float: none;
    flex: 1;
    overflow: auto;
  }
}

#playList {
  width: 100%;
  float: none;

  .item-root {
    padding: 8px 12px;

    .detail {
      max-height: 120px;
      overflow-y: auto;
    }
  }
}
</style>
