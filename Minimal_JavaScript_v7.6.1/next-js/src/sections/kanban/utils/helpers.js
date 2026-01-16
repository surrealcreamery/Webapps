import { once } from '@atlaskit/pragmatic-drag-and-drop/once';

import { kanbanClasses } from '../classes';

// ----------------------------------------------------------------------

export const isSafari = once(
  () =>
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('AppleWebKit') &&
    !navigator.userAgent.includes('Chrome')
);

// ----------------------------------------------------------------------

const attributeMap = {
  dataTaskId: 'data-task-id',
  dataColumnId: 'data-column-id',
  blockBoardPanning: 'data-block-board-panning',
};

export function getAttr(key) {
  return attributeMap[key];
}

// ----------------------------------------------------------------------

export function triggerFlashEffect(attr, targetId, options) {
  const { duration = 1000, className = kanbanClasses.state.flash } = options ?? {};

  requestAnimationFrame(() => {
    const targetEl = document.querySelector(`[${attr}="${targetId}"]`);
    if (!targetEl || !(targetEl instanceof HTMLElement)) return;

    targetEl.classList.remove(className);
    targetEl.classList.add(className);

    setTimeout(() => {
      targetEl.classList.remove(className);
    }, duration);
  });
}

// ----------------------------------------------------------------------

export function isInvalidOrSameIndex(fromIndex, toIndex) {
  return fromIndex < 0 || toIndex < 0 || fromIndex === toIndex;
}

export function isShallowEqual(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => Object.is(a[key], b[key]));
}

// ----------------------------------------------------------------------

export const columnMotionOptions = (columnId) => ({
  layout: 'position',
  layoutId: `kanban-column-${columnId}`,
  transition: {
    layout: { type: 'spring', damping: 48, stiffness: 480 },
  },
});

export const taskMotionOptions = (taskId) => ({
  layout: 'position',
  layoutId: `kanban-item-${taskId}`,
  transition: {
    layout: { type: 'spring', damping: 40, stiffness: 400 },
  },
});
