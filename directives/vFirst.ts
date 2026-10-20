import type { ObjectDirective } from "vue";

/** 参照物：'element' 只跟元素兄弟比，'node' 包含文本/注释节点 */
type FirstTarget = "node" | "element";

export interface VFirstBinding {
  /** 参照物类型，默认 'element' */
  target?: FirstTarget;
  /** 元素自身更新时是否重新校正，默认 true */
  reactive?: boolean;
}

function moveToFirst(el: HTMLElement, target: FirstTarget): void {
  const parent = el.parentNode;
  if (!parent) return;

  const reference =
    target === "element" ? parent.firstElementChild : parent.firstChild;

  // 已经是第一个（或父节点为空）就什么都不做
  if (!reference || reference === el) return;

  parent.insertBefore(el, reference);
}

export const vFirst: ObjectDirective<HTMLElement, VFirstBinding | undefined> = {
  mounted(el, binding) {
    // 放到微任务里执行：子组件的 mounted 早于父组件，
    // 等本轮所有兄弟节点都插入完再校正，避免被"顶"回去
    queueMicrotask(() => {
      moveToFirst(el, binding.value?.target ?? "element");
    });
  },

  updated(el, binding) {
    if (binding.value?.reactive === false) return;
    moveToFirst(el, binding.value?.target ?? "element");
  },
};
