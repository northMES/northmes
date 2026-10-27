// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useCallback, useEffect, useRef, useState } from 'react';

/** The width the view assumes before it has measured itself, as in a test. */
const assumedWidth = 1100;

/** The least height the grid keeps, in rem: a few rows under the header and the Not placed row. */
const minFillRem = 15;

/** The space the page leaves under the grid: the bottom padding of the main area it sits in. */
function bottomGapOf(node: HTMLElement): number {
  const main = node.closest('main');
  const padding =
    main === null ? Number.NaN : Number.parseFloat(getComputedStyle(main).paddingBottom);
  return Number.isFinite(padding) ? padding : 0;
}

/**
 * The height that fills the viewport from an element's top (plan 18, phase 1 findings): the grid
 * takes it, so the page itself never scrolls and the rows scroll inside the grid under the sticky
 * time header. Measured again when the window resizes.
 */
export function useViewportFill(
  layoutKey: string,
): [number | undefined, (node: HTMLElement | null) => void] {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const element = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | undefined>(undefined);
  const measure = useCallback(() => {
    const node = element.current;
    if (node === null || typeof window === 'undefined') return;
    // Viewport coordinates, as innerHeight is: the page may hold a restored scroll position.
    const top = node.getBoundingClientRect().top;
    setHeight(Math.max(minFillRem * remPx(), window.innerHeight - top - bottomGapOf(node)));
  }, []);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      element.current = node;
      observer.current?.disconnect();
      observer.current = undefined;
      measure();
      // The toolbar above wraps its controls, so the parent's height changes move the grid's top.
      if (node?.parentElement && typeof ResizeObserver !== 'undefined') {
        observer.current = new ResizeObserver(() => measure());
        observer.current.observe(node.parentElement);
      }
    },
    [measure],
  );
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  // A zoom or range change redraws the toolbar's range label, which may wrap or unwrap.
  useEffect(() => {
    measure();
  }, [measure, layoutKey]);
  return [height, ref];
}

/** The pixels of one rem, which the row heights are in, read from the document once it exists. */
export function remPx(): number {
  if (typeof document === 'undefined') return 16;
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

/** The width of the whole grid, measured through a ResizeObserver where the browser has one. */
export function useMeasuredWidth(): [number, (node: HTMLElement | null) => void] {
  const [width, setWidth] = useState(assumedWidth);
  const observer = useRef<ResizeObserver | undefined>(undefined);
  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = undefined;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const measured = node.getBoundingClientRect().width;
    if (measured > 0) setWidth(measured);
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined && entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.current.observe(node);
  }, []);
  return [width, ref];
}
