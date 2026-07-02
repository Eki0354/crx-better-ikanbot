<template>
  <div class="flex flex-col justify-center items-center">
    <p v-if="isOAuthing">正在授权...</p>
    <template v-else>
      <p>未授权Dropbox</p>
      <button class="btn-oauth" @click="onOAuth">Drop授权</button>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { onMessage } from "webext-bridge/popup";
import { useDropboxStore } from "../entrypoints/popup/stores/dropbox";

const dbStore = useDropboxStore();

const isOAuthing = ref(false);

onMessage("secret", async ({ data }: any) => {
  isOAuthing.value = true;
  await dbStore.accessOauth(data.secret);
  isOAuthing.value = false;
});

const onOAuth = () => {
  const { WXT_DROPBOX_CLIENT_ID, WXT_OAUTH_REDIRECT_URI } = import.meta.env;

  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", WXT_DROPBOX_CLIENT_ID);
  url.searchParams.set("redirect_uri", WXT_OAUTH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");

  browser.tabs.create({ url: url.toString() });
};
</script>

<style scoped>
.btn-oauth {
  margin-top: 24px;
  will-change: filter;
  transition: filter 300ms;
  border: 1px solid #e0e0e0;
}

.btn-oauth:hover {
  filter: drop-shadow(0 0 2em #54bc4ae0);
  border-color: #54bc4a;
}
</style>
