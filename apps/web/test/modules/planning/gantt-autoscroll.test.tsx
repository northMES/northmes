// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

// Animation frames 1/60 s apart, as a 60 Hz display gives them: the test browser runs them back to
// back, and autoscroll sets its speed per time.
beforeEach(() => {
  let nowMs = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nowMs += 1000 / 60;
    const at = nowMs;
    return window.setTimeout(() => callback(at), 0);
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    window.clearTimeout(handle);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const hour = 3_600_000;

/** A source that answers from G1 and counts its loads, one per range. */
function countingSource(): { source: GanttDataSource; loads: () => number } {
  let count = 0;
  return {
    source: {
      ...g1DataSource,
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
 * high from y 0, 200 px of sticky tree columns, scrolled to 500 px of 3000 px of content.
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

/** Waits for a number of animation frames, each of which scrolls once while autoscroll runs. */
async function frames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

const pointer = { pointerId: 1, button: 0, isPrimary: true, clientY: 300 };

/** Presses a block and drags it to an x, past the drag threshold. */
async function dragTo(gantt: HTMLElement, block: HTMLElement, fromX: number, toX: number) {
  fireEvent.pointerDown(block, { ...pointer, clientX: fromX });
  fireEvent.pointerMove(block, { ...pointer, clientX: fromX + Math.sign(toX - fromX) * 5 });
  await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).not.toBeNull());
  fireEvent.pointerMove(block, { ...pointer, clientX: toX });
}

describe('the time area scrolls while a block is dragged to its edge (#899)', () => {
  it('a drag held near the right edge scrolls the time area and the preview follows the scroll', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-10');
    // The press is outside the margin; 5 px further the drag starts, and 45 px more is in it.
    fireEvent.pointerDown(block, { ...pointer, clientX: 745 });
    fireEvent.pointerMove(block, { ...pointer, clientX: 750 });
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).not.toBeNull());
    const before = previewStart(gantt);

    fireEvent.pointerMove(block, { ...pointer, clientX: 795 });

    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(1400));
    await waitFor(() => expect(previewStart(gantt) - before).toBeGreaterThanOrEqual(4 * hour));
    fireEvent.pointerUp(block, { ...pointer, clientX: 795 });
  });

  it('#899 a drag the scroll takes into the edge margin holds the buffer until the drop, which moves it (ADR 0089)', async () => {
    const { source, loads } = countingSource();
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' }, source);
    const gantt = await findGantt();
    const loaded = loads();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-10');
    await dragTo(gantt, block, 400, 795);
    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(1400));

    fireEvent.scroll(gantt);
    await frames(2);
    expect(loads()).toBe(loaded);

    fireEvent.pointerUp(block, { ...pointer, clientX: 795 });

    await waitFor(() => expect(loads()).toBe(loaded + 1));
  });

  it('the drop ends the scrolling', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-10');
    await dragTo(gantt, block, 400, 795);
    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(600));

    fireEvent.pointerUp(block, { ...pointer, clientX: 795 });
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).toBeNull());
    const scrolledTo = gantt.scrollLeft;
    await frames(5);

    expect(gantt.scrollLeft).toBe(scrolledTo);
  });

  it('Escape during a drag ends the move and the scrolling', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-10');
    await dragTo(gantt, block, 400, 795);
    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(600));

    fireEvent.keyDown(block, { key: 'Escape' });
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).toBeNull());
    const scrolledTo = gantt.scrollLeft;
    await frames(5);

    expect(gantt.scrollLeft).toBe(scrolledTo);
    fireEvent.pointerUp(block, { ...pointer, clientX: 795 });
  });

  it('a drag that starts inside the margin scrolls only after the pointer has left it and come back', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-10');

    // 10 px inside the left edge of the time area, dragged right but still inside the margin.
    await dragTo(gantt, block, 210, 240);
    await frames(5);
    expect(gantt.scrollLeft).toBe(500);

    fireEvent.pointerMove(block, { ...pointer, clientX: 400 });
    fireEvent.pointerMove(block, { ...pointer, clientX: 205 });

    await waitFor(() => expect(gantt.scrollLeft).toBeLessThan(500));
    fireEvent.pointerUp(block, { ...pointer, clientX: 205 });
  });

  it('a drag held near the left edge of the time area stops at the start of the content', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    const block = blockOf(gantt, 'jo-1001-20');

    await dragTo(gantt, block, 500, 205);

    await waitFor(() => expect(gantt.scrollLeft).toBe(0));
    fireEvent.pointerUp(block, { ...pointer, clientX: 205 });
  });

  it('a step in keyboard move mode past the right edge scrolls the time area until the preview shows', async () => {
    renderGanttRoute({ zoom: 'day', from: '2026-11-04' });
    const gantt = await findGantt();
    layOut(gantt);
    // The preview outline starts in view; after the step it lies at 1100 to 1150 px on screen. The
    // focused block lies at 700 to 780 px, far enough right to stay in view.
    let outlineX = 400;
    const box = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this.hasAttribute('data-move-preview')) {
        return DOMRect.fromRect({ x: outlineX, width: 50 });
      }
      if (this.getAttribute('data-block') === 'jo-1001-10') {
        return DOMRect.fromRect({ x: 700, width: 80 });
      }
      return box.call(this);
    });
    blockOf(gantt, 'jo-1001-10').focus();
    await userEvent.keyboard('m');
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).not.toBeNull());
    expect(gantt.scrollLeft).toBe(500);

    outlineX = 1100;
    await userEvent.keyboard('{ArrowRight}');

    // The outline overhangs the visible right edge at 800 px by 350 px.
    await waitFor(() => expect(gantt.scrollLeft).toBe(850));
    await userEvent.keyboard('{Escape}');
  });
});
