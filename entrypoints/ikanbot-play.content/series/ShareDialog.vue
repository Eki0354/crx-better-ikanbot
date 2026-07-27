<template>
  <el-dialog
    v-model="model"
    title="分享截图"
    draggable
    width="705px"
    append-to-body
    :z-index="20000"
    @opened="onOpened"
    @close="onClose"
  >
    <div v-loading="loading" element-loading-text="正在获取豆瓣数据...">
      <div class="screenshot-preview">
        <div
          v-if="displayHTML"
          ref="shadowHostRef"
          class="preview-wrap"
          :class="screenshotData.html && 'has-exact-target'"
          v-html="displayHTML"
        />

        <el-empty v-else :description="error || '暂无数据'" />
      </div>
    </div>

    <template v-if="!loading" #footer>
      <div class="dialog-footer">
        <el-button @click="onCopy">
          {{ capturing ? "截图中. . ." : "复制" }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { sendMessage } from "webext-bridge/content-script";
import { ElNotification } from "element-plus";
import "element-plus/theme-chalk/el-notification.css";
import { imgToBase64 } from "../utils";
import { domToBlob } from "modern-screenshot";

type ScreenshotData = {
  url: string;
  html: string;
  css: string;
};

type ShareDialogProps = {
  link: string;
};

const props = defineProps<ShareDialogProps>();
const model = defineModel({ default: false });

const shadowHostRef = ref<HTMLDivElement>();

const loading = ref(false);
const error = ref("");
const capturing = ref(false);
const screenshotData = reactive<ScreenshotData>({ url: "", html: "", css: "" });
const pageHTML = ref("");

const displayHTML = computed(() => {
  if (screenshotData.html)
    return `<style>${screenshotData.css}</style>${screenshotData.html}`;
  return pageHTML.value || "";
});

async function onOpened() {
  if (!props.link) {
    error.value = "缺少豆瓣链接";
    return;
  }

  loading.value = true;
  error.value = "";
  screenshotData.html = "";
  screenshotData.css = "";

  try {
    let data: ScreenshotData | undefined = undefined;

    if (props.link.startsWith("https://movie.douban")) {
      data = (await sendMessage("douban_screenshot", {
        url: props.link,
      })) as ScreenshotData | undefined;

      screenshotData.html = data?.html || "";
      screenshotData.css = data?.css || "";
    }

    if (!data?.html) {
      const [currentPageSvg, homePageSvg] = await Promise.all([
        genCurrentPageQRCodeHTML(),
        genHomePageQRCodeHTML(),
      ]);
      // 没获取到豆瓣数据时，展示页面自身的内容
      const el = document.querySelector(".row:has(#playList) .result-info");

      // 封面图片跨域，必须手动请求转为base64才能截图成功
      if (el) {
        await imgToBase64(el.querySelector(".item-root > .cover")!);
      }

      pageHTML.value = (el?.outerHTML || "") + currentPageSvg + homePageSvg;
    }
  } catch (e) {
    console.log("[ShareDialog] request screenshot error", e);
    error.value = "请求截图数据失败";
  } finally {
    loading.value = false;
  }
}

function onClose() {
  pageHTML.value = "";
  screenshotData.html = "";
  screenshotData.css = "";
  error.value = "";
}

async function onCopy() {
  if (!shadowHostRef.value) return;

  capturing.value = true;

  try {
    const blob = await domToBlob(shadowHostRef.value);

    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

    ElNotification({
      type: "success",
      title: "提示",
      message: "已复制到剪贴板",
      zIndex: 99999,
    });
  } catch (error) {
    console.error(error);
  } finally {
    capturing.value = false;
  }
}
</script>

<style lang="scss" scoped>
.screenshot-preview {
  display: flex;
  justify-content: center;
  align-items: center;
}

.preview-wrap {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 700px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  box-sizing: border-box;
  padding: 4px 8px;

  &.has-exact-target {
    flex-direction: column;
    align-items: flex-start;
  }

  :deep(.subjectwrap) {
    margin: 0 auto;
  }

  :deep(.result-info) {
    flex: 1;

    .douban-search-link,
    .btn-douban-share {
      display: none;
    }
  }
}
</style>
