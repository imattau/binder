import { dndzone } from 'svelte-dnd-action';
import type { Item, Options } from 'svelte-dnd-action';

function supportsTouch() {
  if (typeof window === 'undefined') return false;
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

export function smartDndzone<T extends Item>(node: HTMLElement, params: Options<T>) {
  if (supportsTouch()) {
    return {
      update() {},
      destroy() {}
    };
  }

  return dndzone(node, params);
}
