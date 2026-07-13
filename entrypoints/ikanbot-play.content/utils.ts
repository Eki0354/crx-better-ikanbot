/**
 * 等待指定的 DOM 元素出现在页面中
 * @param selector - CSS 选择器，例如 '#app'、'.comment-box'
 * @param timeout - 超时时间（毫秒），默认 10000（10秒）
 * @returns Promise<Element> - 当元素出现时 resolve，超时则 reject
 */
export function waitForElement(
  selector: string,
  timeout = 10000,
): Promise<Element> {
  return new Promise((resolve, reject) => {
    // 如果元素已经存在，直接返回
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    let timeoutId: number;
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        obs.disconnect();
        resolve(element);
      }
    });

    // 开始观察 DOM 变化
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 设置超时
    timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`等待元素 ${selector} 超时（${timeout}ms）`));
    }, timeout);
  });
}

export function showSeriesSidebar() {
  const sidebar: HTMLDivElement | null = document.querySelector(
    ".row:has(#playList)",
  );
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

export function hideSeriesSidebar() {
  const sidebar: HTMLDivElement | null = document.querySelector(
    ".row:has(#playList)",
  );
  if (sidebar) sidebar.style.display = "none";
}
