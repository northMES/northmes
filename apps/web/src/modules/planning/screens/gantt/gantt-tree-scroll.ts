// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type FocusEvent, useCallback, useLayoutEffect, useRef } from 'react';

/** The cells of a tree pane, which focus may land in. */
const cellSelector = '[role="columnheader"], [role="rowheader"], [role="gridcell"]';

/** How long after focus lands in the pane a scroll of the grid is taken as the focus's own. */
const focusScrollMs = 150;

export interface TreePaneScroll {
  /** The grid's ref: the grid carries --tree-scroll and listens for a sideways wheel. */
  readonly gridRef: (node: HTMLElement | null) => void;
  /** The ref of the pane's own scrollbar, rendered while the tree columns are wider than the pane. */
  readonly scrollerRef: (node: HTMLDivElement | null) => void;
  /** Its scroll listener. */
  readonly onScrollerScroll: () => void;
  /** The grid's focus listener, which scrolls the pane to a cell that takes focus in it. */
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
}

/**
 * The tree pane's own sideways scroll (#943). The pane's scrollbar is a native scroller as wide as
 * the pane under the rows; its position goes to --tree-scroll on the grid, which every row's tree
 * cells are shifted by, so the time area keeps its own scroll and no render runs on a scroll. A
 * sideways wheel or trackpad swipe over the pane scrolls the pane, its vertical part still the
 * rows, and a cell that takes focus in it is scrolled into the pane. The browser also scrolls the
 * grid to bring such a cell past the scroll padding, though the pane sticks; that scroll is put
 * back, before the time buffer reads it, so focus in the pane never moves the time area.
 */
export function useTreePaneScroll({
  innerWidth,
  contentWidth,
}: {
  /** What the pane shows of its columns at once. */
  readonly innerWidth: number;
  readonly contentWidth: number;
}): TreePaneScroll {
  const grid = useRef<HTMLElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  /** The pane's position, kept while the scrollbar is not rendered. */
  const position = useRef(0);
  /** What the pane shows and how far it scrolls, which the wheel listener reads when it runs. */
  const layout = useRef({ innerWidth, range: 0 });
  /** The grid's position as its last scroll event left it. */
  const settled = useRef({ left: 0, top: 0 });
  /** Until when a scroll of the grid is the browser bringing a focused pane cell into view. */
  const focusScrollUntil = useRef(0);
  /**
   * Whether the focus scroll being undone is a header's, which sticks at the top as well, so the
   * rows' vertical position is kept too; a row's cells stick only sideways.
   */
  const keepTop = useRef(false);
  /** Puts the grid back where its last scroll event left it. */
  const keepGrid = useCallback(() => {
    const node = grid.current;
    if (node === null) return;
    if (node.scrollLeft !== settled.current.left) node.scrollLeft = settled.current.left;
    if (keepTop.current && node.scrollTop !== settled.current.top) {
      node.scrollTop = settled.current.top;
    }
  }, []);
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
    layout.current = { innerWidth, range: Math.max(0, contentWidth - innerWidth) };
    scrollTo(position.current);
  }, [scrollTo, innerWidth, contentWidth]);
  // A sideways wheel or swipe over the pane scrolls the pane, not the time area. The listener is
  // the grid's own, since React's wheel listener is passive and cannot keep the grid still.
  const onWheel = useCallback(
    (event: WheelEvent) => {
      if (layout.current.range === 0 || event.ctrlKey || !(event.target instanceof Element)) return;
      if (event.target.closest('[data-tree-pane]') === null) return;
      const sideways = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const shifted = event.deltaX === 0 && event.shiftKey;
      // A wheel that counts lines or pages, as Firefox's may, scrolls by lines of 16 px or by the pane.
      const page = event.deltaMode === WheelEvent.DOM_DELTA_PAGE;
      const line = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      const delta =
        (shifted ? event.deltaY : event.deltaX) * (page ? layout.current.innerWidth : line);
      if (!sideways || delta === 0) return;
      event.preventDefault();
      scrollTo(position.current + delta);
      // The vertical part of a diagonal swipe still scrolls the rows.
      if (!shifted && event.deltaY !== 0 && grid.current !== null) {
        grid.current.scrollTop += event.deltaY * (page ? grid.current.clientHeight : line);
      }
    },
    [scrollTo],
  );
  // A capture listener, so it runs before the grid's own scroll listener on the same element.
  const onGridScroll = useCallback(() => {
    const node = grid.current;
    if (node === null) return;
    if (performance.now() < focusScrollUntil.current) keepGrid();
    settled.current = { left: node.scrollLeft, top: node.scrollTop };
  }, [keepGrid]);
  const gridRef = useCallback(
    (node: HTMLElement | null) => {
      grid.current?.removeEventListener('wheel', onWheel);
      grid.current?.removeEventListener('scroll', onGridScroll, { capture: true });
      grid.current = node;
      node?.addEventListener('wheel', onWheel, { passive: false });
      node?.addEventListener('scroll', onGridScroll, { capture: true, passive: true });
      if (node !== null) settled.current = { left: node.scrollLeft, top: node.scrollTop };
      node?.style.setProperty('--tree-scroll', `${position.current}px`);
    },
    [onWheel, onGridScroll],
  );
  const scrollerRef = useCallback((node: HTMLDivElement | null) => {
    scroller.current = node;
    if (node !== null) node.scrollLeft = position.current;
  }, []);
  const onScrollerScroll = useCallback(() => {
    const node = scroller.current;
    if (node !== null) scrollTo(node.scrollLeft);
  }, [scrollTo]);
  const onFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!(event.target instanceof HTMLElement)) return;
      // Focus elsewhere, as on a row, may scroll the grid as the browser likes.
      if (event.target.closest('[data-tree-pane]') === null) {
        focusScrollUntil.current = 0;
        return;
      }
      keepTop.current = event.target.closest('[role="columnheader"]') !== null;
      keepGrid();
      focusScrollUntil.current = performance.now() + focusScrollMs;
      if (layout.current.range === 0) return;
      const cell = event.target.closest<HTMLElement>(cellSelector);
      if (cell === null) return;
      const left = cell.offsetLeft;
      const right = left + cell.offsetWidth;
      if (left < position.current) scrollTo(left);
      else if (right > position.current + layout.current.innerWidth) {
        scrollTo(right - layout.current.innerWidth);
      }
    },
    [scrollTo, keepGrid],
  );
  return { gridRef, scrollerRef, onScrollerScroll, onFocus };
}
