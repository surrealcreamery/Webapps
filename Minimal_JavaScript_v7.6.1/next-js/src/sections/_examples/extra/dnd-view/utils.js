import { uuidv4 } from 'minimal-shared/utils';
import { useState, useCallback } from 'react';

import { dndClasses } from './classes';

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

export function triggerFlashEffect(attr, targetId, options) {
  const { duration = 1000, className = dndClasses.state.flash } = options ?? {};

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

export function useManageItems({ orientation, initialItems, sortableListRef }) {
  const [items, setItems] = useState(initialItems);

  const scrollToEnd = useCallback(() => {
    const sortableListEl = sortableListRef?.current;
    if (!sortableListEl || !orientation) return;

    const scrollOptions =
      orientation === 'vertical'
        ? { top: sortableListEl.scrollHeight }
        : { left: sortableListEl.scrollWidth };

    setTimeout(() => {
      sortableListEl.scrollTo({ ...scrollOptions, behavior: 'smooth' });
    }, 0);
  }, [sortableListRef, orientation]);

  const addItem = useCallback(() => {
    setItems((prevItems) => {
      const newItem = {
        id: `id-${uuidv4()}`,
        name: `${prevItems.length + 1}`,
      };
      return [...prevItems, newItem];
    });

    scrollToEnd();
  }, [scrollToEnd]);

  const removeItem = useCallback((itemId) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
  }, []);

  return {
    items,
    addItem,
    setItems,
    removeItem,
  };
}
