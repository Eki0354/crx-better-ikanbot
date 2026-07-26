<template>
  <el-dialog
    v-model="model"
    title="分享截图"
    draggable
    width="734px"
    @opened="onOpened"
    @close="onClose"
  >
    <div v-loading="loading" element-loading-text="正在获取豆瓣数据...">
      <div class="screenshot-preview">
        <el-empty v-if="error" :description="error" />

        <div
          v-if="ssHTML"
          ref="shadowHostRef"
          class="preview-wrap"
          v-html="ssHTML"
        />

        <el-empty v-else-if="!loading && !error" description="暂无数据" />
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
import html2canvas from "html2canvas";

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

const ssHTML = computed(() => {
  const { css, html } = screenshotData;
  return html ? `<style>${css}</style>${html}` : "";
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
    const data = (await sendMessage("douban_screenshot", {
      url: props.link,
    })) as ScreenshotData | undefined;

    if (!data?.html || !data?.css) {
      error.value = "未获取到豆瓣页面数据";
      return;
    }

    screenshotData.html = data.html;
    screenshotData.css = data.css;
  } catch (e) {
    console.log("[ShareDialog] request screenshot error", e);
    error.value = "请求截图数据失败";
  } finally {
    loading.value = false;
  }
}

function onClose() {
  screenshotData.html = "";
  screenshotData.css = "";
  error.value = "";
}

async function onCopy() {
  if (!shadowHostRef.value) return;

  capturing.value = true;

  try {
    const node = shadowHostRef.value.querySelector(":scope .subjectwrap") as HTMLElement | null;
    if (!node) return;

    // 截图前把元素设为 inline-block，宽度自适应内容，避免右侧空白
    node.style.display = "inline-block";
    node.style.width = "auto";
    node.style.padding = "4px 8px";

    const canvas = await html2canvas(node, {
      useCORS: true,
      ignoreElements: (el) => el.classList.contains("gact"),
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return;

    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

    ElNotification({
      type: 'success',
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
  min-height: 200px;
}

.preview-wrap {
  margin: 0 auto;
  width: 700px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  box-sizing: border-box;

  :deep(.subjectwrap) {
    margin: 0 auto;
    padding: 4px 8px;
  }
}
</style>
