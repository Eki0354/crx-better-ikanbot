import type { ObjectDirective } from "vue";

/** 参照物：'element' 只跟元素兄弟比，'node' 包含文本/注释节点 */
type LastTarget = "node" | "element";

export interface VLastBinding {
  /** 参照物类型，默认 'element' */
  target?: LastTarget;
  /** 元素自身更新时是否重新校正，默认 true */
  reactive?: boolean;
}

function moveToLast(el: HTMLElement, target: LastTarget): void {
  const parent = el.parentNode;
  if (!parent) return;

  const reference =
    target === "element" ? parent.lastElementChild : parent.lastChild;

  if (!reference || reference === el) return;

  parent.appendChild(el);
}

export const vFirst: ObjectDirective<HTMLElement, VLastBinding | undefined> = {
  mounted(el, binding) {
    queueMicrotask(() => {
      moveToLast(el, binding.value?.target ?? "element");
    });
  },

  updated(el, binding) {
    if (binding.value?.reactive === false) return;
    moveToLast(el, binding.value?.target ?? "element");
  },
};
