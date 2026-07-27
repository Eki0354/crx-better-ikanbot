<template>
  <a ref="linkRef" class="douban-search-link" target="_blank" :href="link">
    {{ link ? (hasExactTarget ? "豆瓣" : "豆瓣搜索") : "" }}
  </a>

  <img
    v-if="!loading"
    class="btn-douban-share"
    :src="shareIcon"
    @click="onShare"
  />

  <ShareDialog v-model="shareDialogVisible" :link="link" />
</template>

<script setup lang="ts">
import { sendMessage } from "webext-bridge/content-script";
import shareIcon from "~/assets/share.png";
import ShareDialog from "./ShareDialog.vue";

const linkRef = ref<HTMLLinkElement>();
const link = ref("");

const hasExactTarget = ref(false);
const shareDialogVisible = ref(false);
const loading = ref(false);

const init = async (title: string) => {
  if (hasExactTarget.value && link.value) return;

  loading.value = true;
  const res = await sendMessage("douban_link", { title });
  loading.value = false;
  const url = res as string;
  if (!url) return;

  link.value = url;
  hasExactTarget.value = true;
};

const onShare = () => {
  if (!link.value) return;

  shareDialogVisible.value = true;
};

onMounted(() => {
  if (!linkRef.value) return;

  const title = (linkRef.value.parentElement as HTMLElement)?.textContent;
  link.value = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(title)}&cat=1002`;
  init(title);
});
</script>

<style lang="scss" scoped>
.douban-search-link {
  margin-left: 8px;

  &:focus {
    outline: none;
  }
}

.btn-douban-share {
  cursor: pointer;
  display: inline-block;
  width: 16px;
  aspect-ratio: 1/1;
  margin-left: 8px;
  margin-top: -4px;
}
</style>
