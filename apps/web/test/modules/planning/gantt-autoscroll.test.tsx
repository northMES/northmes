// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A source that answers from G1 and counts its loads, one per range. */
function countingSource(): { source: GanttDataSource; loads: () => number } {
  let count = 0;
  return {
    source: {
      load: (input) => {
        count += 1;
        return g1DataSource.load(input);
      },
    },
    loads: () => count,
  };
}

/**
 * Gives the grid the geometry the test browser has no layout for: 800 px wide from x 0, 600 px
 * high from y 0, scrolled to 500 px of 3000 px of content.
 */
function layOut(gantt: HTMLElement) {
  const geometry = { scrollWidth: 3000, clientWidth: 800, scrollHeight: 600, clientHeight: 600 };
  for (const [key, value] of Object.entries(geometry)) {
    Object.defineProperty(gantt, key, { value, configurable: true });
  }
  Object.defineProperty(gantt, 'scrollLeft', { value: 500, configurable: true, writable: true });
  gantt.style.scrollPaddingInlineStart = '200px';
  gantt.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 600 });
}

function blockOf(gantt: HTMLElement, jobOrderId: string): HTMLElement {
  const block = gantt.querySelector<HTMLElement>(`[data-block="${jobOrderId}"]`);
  if (block === null) throw new Error(`No block ${jobOrderId}`);
  return block;
}

function previewStart(gantt: HTMLElement): number {
  return Number(gantt.querySelector('[data-move-preview]')?.getAttribute('data-from-ms'));
}

const pointer = { pointerId: 1, button: 0, isPrimary: true, clientY: 300 };

describe('the time area scrolls while a block is dragged to its edge (#899)', () => {
  it('a drag held near the right edge scrolls the time area, the preview follows, and the range does not grow', async () => {
    const { source, loads } = countingSource();
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' }, source);
    const gantt = await findGantt();
    const loaded = loads();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-10');

    fireEvent.pointerDown(block, { ...pointer, clientX: 400 });
    fireEvent.pointerMove(block, { ...pointer, clientX: 420 });
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).not.toBeNull());
    const before = previewStart(gantt);
    fireEvent.pointerMove(block, { ...pointer, clientX: 795 });

    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(1400));
    await waitFor(() => expect(previewStart(gantt)).toBeGreaterThan(before));
    // A scroll the drag makes past the point where the range would grow leaves the range as it is.
    fireEvent.scroll(gantt);
    fireEvent.pointerUp(block, { ...pointer, clientX: 795 });

    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).toBeNull());
    const scrolledTo = gantt.scrollLeft;
    expect(loads()).toBe(loaded);
    // The drop ends the scrolling.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gantt.scrollLeft).toBe(scrolledTo);
  });

  it('a drag held near the left edge of the time area stops at the start of the content', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    gantt.style.scrollPaddingInlineStart = '200px';
    const block = blockOf(gantt, 'jo-1001-20');

    fireEvent.pointerDown(block, { ...pointer, clientX: 500 });
    fireEvent.pointerMove(block, { ...pointer, clientX: 205 });

    await waitFor(() => expect(gantt.scrollLeft).toBe(0));
    fireEvent.pointerUp(block, { ...pointer, clientX: 205 });
  });

  it('a step in keyboard move mode scrolls the preview into view', async () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    blockOf(gantt, 'jo-1001-10').focus();

    await userEvent.keyboard('m');
    scrolled.mockClear();
    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() => {
      const outlines = scrolled.mock.contexts.filter(
        (element) => (element as Element).getAttribute('data-move-preview') === 'jo-1001-10',
      );
      expect(outlines.length).toBeGreaterThan(0);
    });
    await userEvent.keyboard('{Escape}');
  });
});
