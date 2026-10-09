// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useRef } from 'react';

/** The room between the sticky block and a control the page scrolls to, so the ring clears it. */
const ringClearance = 8;

/**
 * Focus not obscured (WCAG 2.4.11, D2 KE19 and KE20): returns a ref for the sticky block at the
 * top of the page, the top bar with any strips under it, and keeps the page's scroll-padding-top
 * at its height plus 8 px, measured with a ResizeObserver because strips wrap, appear and go. The
 * browser then scrolls a focused control clear of the block. The padding goes when the block does.
 */
export function useScrollPaddingTop<T extends HTMLElement>() {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((block: T | null) => {
    const page = document.documentElement;
    observer.current?.disconnect();
    observer.current = null;
    if (block === null) {
      page.style.removeProperty('scroll-padding-top');
      return;
    }
    if (typeof ResizeObserver !== 'function') return;
    observer.current = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? entry?.contentRect.height;
      if (height !== undefined) page.style.scrollPaddingTop = `${height + ringClearance}px`;
    });
    observer.current.observe(block);
  }, []);
}
