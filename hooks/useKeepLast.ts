// src/hooks/useKeepLast.ts
import { onMounted, onUnmounted, nextTick } from "vue";

export interface UseKeepLastOptions {
  /** 父节点选择器，如 '.list' */
  parent: string;
  /** 子节点选择器（只匹配父节点的直接子元素），如 '.pinned' */
  child: string;
  /**
   * 是否监听 document 中动态出现的父节点，默认 true。
   * 父节点若在组件挂载时已存在，可设为 false 省掉全局 observer 的开销。
   */
  watchNewParents?: boolean;
}

export interface UseKeepLastReturn {
  /** 手动校正一次（例如业务数据更新后主动兜底） */
  flush: () => void;
  /** 停止监听并清理所有 observer */
  stop: () => void;
}

export function useKeepLast(options: UseKeepLastOptions): UseKeepLastReturn {
  const {
    parent: parentSelector,
    child: childSelector,
    watchNewParents = true,
  } = options;

  /** 每个父节点一个 observer，只监听它的 childList */
  const parentObservers = new Map<HTMLElement, MutationObserver>();
  /** 监听 document 中新增 / 移除父节点 */
  let documentObserver: MutationObserver | null = null;
  let stopped = false;

  function getTargets(parent: HTMLElement): HTMLElement[] {
    const targets: HTMLElement[] = [];
    // 用 Array.from 快照，避开 live HTMLCollection 在 appendChild 时被改动
    for (const el of Array.from(parent.children)) {
      if (el.matches(childSelector)) targets.push(el as HTMLElement);
    }
    return targets;
  }

  function isAtEnd(parent: HTMLElement, targets: HTMLElement[]): boolean {
    if (targets.length === 0) return true;
    const children = parent.children;
    const start = children.length - targets.length;
    if (start < 0) return true;
    for (let i = 0; i < targets.length; i++) {
      if (children[start + i] !== targets[i]) return false;
    }
    return true;
  }

  function moveToEnd(parent: HTMLElement): void {
    const targets = getTargets(parent);
    // 已经在末尾就直接返回——这是避免 observer 死循环的关键
    if (isAtEnd(parent, targets)) return;
    // 按 DOM 原顺序 appendChild：每次 append 都会把该元素移到末尾，
    // 最终相对顺序与 targets 一致
    for (const el of targets) parent.appendChild(el);
  }

  function registerParent(parent: HTMLElement): void {
    if (parentObservers.has(parent)) return;
    const observer = new MutationObserver(() => {
      if (!stopped) moveToEnd(parent);
    });
    observer.observe(parent, { childList: true });
    parentObservers.set(parent, observer);
    // 注册后立即校正一次，处理"父节点先出现、子节点已存在"的场景
    moveToEnd(parent);
  }

  function unregisterParent(parent: HTMLElement): void {
    parentObservers.get(parent)?.disconnect();
    parentObservers.delete(parent);
  }

  function scan(): void {
    document
      .querySelectorAll<HTMLElement>(parentSelector)
      .forEach(registerParent);
  }

  function setupDocumentObserver(): void {
    documentObserver = new MutationObserver((mutations) => {
      if (stopped) return;
      for (const mutation of mutations) {
        // 父节点被移出 document：注销 observer，避免泄漏
        mutation.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (parentObservers.has(node)) unregisterParent(node);
          if (parentObservers.size > 0) {
            for (const parent of Array.from(parentObservers.keys())) {
              if (node.contains(parent)) unregisterParent(parent);
            }
          }
        });
        // 新增节点里可能带新的父节点（本身或后代）
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(parentSelector)) registerParent(node);
          node
            .querySelectorAll<HTMLElement>(parentSelector)
            .forEach(registerParent);
        });
      }
    });
    // body 已存在：onMounted 时一定已挂载
    documentObserver.observe(document.body, { childList: true, subtree: true });
  }

  function flush(): void {
    if (stopped) return;
    scan();
    parentObservers.forEach((_, parent) => moveToEnd(parent));
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    parentObservers.forEach((o) => o.disconnect());
    parentObservers.clear();
    documentObserver?.disconnect();
    documentObserver = null;
  }

  onMounted(() => {
    // 延后一个微任务：兼容 Suspense / 异步组件 / Teleport 等边界，
    // 保证本轮 flush 的 DOM 已经稳定
    nextTick(() => {
      if (stopped) return;
      flush();
      if (watchNewParents) setupDocumentObserver();
    });
  });

  onUnmounted(stop);

  return { flush, stop };
}
