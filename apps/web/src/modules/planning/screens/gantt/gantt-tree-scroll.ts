// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type FocusEvent, useCallback, useLayoutEffect, useRef } from 'react';

/** The cells of a tree pane, which focus may land in. */
const cellSelector = '[role="columnheader"], [role="rowheader"], [role="gridcell"]';

export interface TreePaneScroll {
  /** The grid's ref: the grid carries --tree-scroll and listens for a sideways wheel. */
  readonly gridRef: (node: HTMLElement | null) => void;
  /** The ref of the pane's own scrollbar, rendered while the tree columns are wider than the pane. */
  readonly scrollerRef: (node: HTMLDivElement | null) => void;
  /** Its scroll listener. */
  readonly onScrollerScroll: () => void;
  /** The grid's focus listener, which scrolls the pane to a cell that takes focus in it. */
  readonly onFocusCapture: (event: FocusEvent<HTMLElement>) => void;
}

/**
 * The tree pane's own sideways scroll (#943). The pane's scrollbar is a native scroller as wide as
 * the pane under the rows; its position goes to --tree-scroll on the grid, which every row's tree
 * cells are shifted by, so the time area keeps its own scroll and no render runs on a scroll. A
 * sideways wheel or trackpad swipe over the pane scrolls the pane, and a cell that takes focus in
 * it is scrolled into the pane.
 */
export function useTreePaneScroll({
  paneWidth,
  contentWidth,
}: {
  readonly paneWidth: number;
  readonly contentWidth: number;
}): TreePaneScroll {
  const grid = useRef<HTMLElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  /** The pane's position, kept while the scrollbar is not rendered. */
  const position = useRef(0);
  /** The pane's width and how far it scrolls, which the wheel listener reads when it runs. */
  const layout = useRef({ paneWidth, range: 0 });
  const scrollTo = useCallback((left: number) => {
    const next = Math.min(layout.current.range, Math.max(0, left));
    position.current = next;
    if (scroller.current !== null && scroller.current.scrollLeft !== next) {
      scroller.current.scrollLeft = next;
    }
    grid.current?.style.setProperty('--tree-scroll', `${next}px`);
  }, []);
  // A wider pane or fewer columns leave less to scroll: the position stays within the range.
  useLayoutEffect(() => {
    layout.current = { paneWidth, range: Math.max(0, contentWidth - paneWidth) };
    scrollTo(position.current);
  }, [scrollTo, paneWidth, contentWidth]);
  // A sideways wheel or swipe over the pane scrolls the pane, not the time area. The listener is
  // the grid's own, since React's wheel listener is passive and cannot keep the grid still.
  const onWheel = useCallback(
    (event: WheelEvent) => {
      if (layout.current.range === 0 || event.ctrlKey || !(event.target instanceof Element)) return;
      if (event.target.closest('[data-tree-pane]') === null) return;
      const sideways = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = event.deltaX === 0 && event.shiftKey ? event.deltaY : event.deltaX;
      if (!sideways || delta === 0) return;
      event.preventDefault();
      scrollTo(position.current + delta);
    },
    [scrollTo],
  );
  const gridRef = useCallback(
    (node: HTMLElement | null) => {
      grid.current?.removeEventListener('wheel', onWheel);
      grid.current = node;
      node?.addEventListener('wheel', onWheel, { passive: false });
      node?.style.setProperty('--tree-scroll', `${position.current}px`);
    },
    [onWheel],
  );
  const scrollerRef = useCallback((node: HTMLDivElement | null) => {
    scroller.current = node;
    if (node !== null) node.scrollLeft = position.current;
  }, []);
  const onScrollerScroll = useCallback(() => {
    const node = scroller.current;
    if (node !== null) scrollTo(node.scrollLeft);
  }, [scrollTo]);
  const onFocusCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (layout.current.range === 0 || !(event.target instanceof HTMLElement)) return;
      if (event.target.closest('[data-tree-pane]') === null) return;
      const cell = event.target.closest<HTMLElement>(cellSelector);
      if (cell === null) return;
      const left = cell.offsetLeft;
      const right = left + cell.offsetWidth;
      if (left < position.current) scrollTo(left);
      else if (right > position.current + layout.current.paneWidth) {
        scrollTo(right - layout.current.paneWidth);
      }
    },
    [scrollTo],
  );
  return { gridRef, scrollerRef, onScrollerScroll, onFocusCapture };
}
