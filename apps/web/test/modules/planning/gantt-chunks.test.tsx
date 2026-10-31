// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { findGantt, measureGridsAt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A source that answers from G1 and counts the loads of each time chunk by its start. */
function countingChunks(
  hold: (from: string) => Promise<void> | Error | undefined = () => undefined,
) {
  const loads: string[] = [];
  const source: GanttDataSource = {
    ...g1DataSource,
    loadChunk: async (from, to, filter, options) => {
      loads.push(from);
      const held = hold(from);
      if (held instanceof Error) throw held;
      if (held !== undefined) await held;
      return g1DataSource.loadChunk(from, to, filter, options);
    },
  };
  return { source, loads };
}

/** Scrolls the grid to the right or left edge of its time buffer, which moves the buffer. */
function toEdge(gantt: HTMLElement, side: 'right' | 'left') {
  const overlay = gantt.querySelector<HTMLElement>('[data-overlay]') as HTMLElement;
  gantt.scrollLeft = side === 'right' ? Number.parseFloat(overlay.style.width) : 0;
  fireEvent.scroll(gantt);
}

const chunkStatus = () => document.querySelector('[data-chunk-status]')?.textContent ?? '';

/** The first cell of the time header, which a move of the time buffer changes. */
const bufferStart = (gantt: HTMLElement) =>
  gantt.querySelector('[data-tier="top"] .sr-only')?.textContent ?? '';

describe('ADR0089 the time chunks of the order Gantt (Loading by time chunk)', () => {
  it('ADR0089 loads each chunk once while the view crosses four chunks, and nothing when it goes back within two buffer widths', async () => {
    const { source, loads } = countingChunks();
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    const gantt = await findGantt();
    await waitFor(() => expect(chunkStatus()).toBe(''));

    // From W45 into W49 at Week.
    for (
      let step = 0;
      step < 40 && !loads.some((from) => from.startsWith('2026-12-06'));
      step += 1
    ) {
      toEdge(gantt, 'right');
      await waitFor(() => expect(chunkStatus()).toBe(''));
    }
    expect(loads.some((from) => from.startsWith('2026-12-06'))).toBe(true);
    expect(new Set(loads).size).toBe(loads.length);

    const crossed = loads.length;
    for (let step = 0; step < 2; step += 1) {
      const before = bufferStart(gantt);
      toEdge(gantt, 'left');
      // The buffer moved back before anything is counted.
      await waitFor(() => expect(bufferStart(gantt)).not.toBe(before));
      await waitFor(() => expect(chunkStatus()).toBe(''));
    }
    expect(loads).toHaveLength(crossed);
  }, 60_000);

  it('ADR0089 shows a chunk that is loading as a loading band, and says so politely', async () => {
    const never = new Promise<void>(() => {});
    const { source } = countingChunks((from) =>
      from.startsWith('2026-11-01T23') ? never : undefined,
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    // The chunk keeps loading, so the grid is found without waiting for its chunks.
    const gantt = await screen.findByRole('treegrid', { name: /order Gantt/ });

    await waitFor(() =>
      expect(
        gantt.querySelector('[data-chunk-band="loading"][data-chunk="2026-W45"]'),
      ).not.toBeNull(),
    );
    expect(chunkStatus()).toBe('Loading the job orders of W45, Mon 2 Nov to Sun 8 Nov.');
    // The rows are drawn while their job orders load, and no block stands in the loading week.
    expect(gantt.querySelector('[data-row-kind="order"]')).not.toBeNull();
    expect(gantt.querySelector('[data-block="jo-1003-10"]')).toBeNull();
  });

  it('ADR0089 shows a chunk that fails as an error band with Try again, which loads it again', async () => {
    let failing = true;
    const { source, loads } = countingChunks((from) =>
      failing && from.startsWith('2026-11-01T23')
        ? new Error('The plan server did not answer')
        : undefined,
    );
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, source);
    const gantt = await findGantt();

    await waitFor(() =>
      expect(
        gantt.querySelector('[data-chunk-band="failed"][data-chunk="2026-W45"]'),
      ).not.toBeNull(),
    );
    expect(chunkStatus()).toBe(
      'The job orders of W45, Mon 2 Nov to Sun 8 Nov could not be loaded.',
    );

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again: job orders' }));

    await waitFor(() => expect(gantt.querySelector('[data-block="jo-1003-10"]')).not.toBeNull());
    expect(gantt.querySelector('[data-chunk-band]')).toBeNull();
    expect(loads.filter((from) => from.startsWith('2026-11-01T23'))).toHaveLength(2);
  });
});

describe('ADR0090 the time chunks during a zoom gesture (Laying out a zoom)', () => {
  beforeEach(() => measureGridsAt(1400));

  /** A Ctrl+wheel event in pixel mode over the time area. */
  function ctrlWheel(gantt: HTMLElement, deltaY: number) {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      ctrlKey: { value: true },
      clientX: { value: 1200 },
      deltaMode: { value: 0 },
    });
    gantt.dispatchEvent(event);
  }

  /** Whether a load started at the first of a month in Stockholm: a month chunk's start. */
  const monthChunk = (from: string) =>
    /^\d{4}-\d{2}-(?:28|29|30|31)T2[23]:00/.test(from) &&
    new Date(Date.parse(from) + 3 * 3_600_000).getUTCDate() === 1;

  it('#941 a gesture from the Week band to the 4 weeks band loads the month chunks once, after it ends', async () => {
    const loadedAt: number[] = [];
    const { source, loads } = countingChunks(() => {
      loadedAt.push(performance.now());
      return undefined;
    });
    renderGanttRoute({ from: '2026-11-02' }, source);
    const gantt = await findGantt();
    await waitFor(() => expect(chunkStatus()).toBe(''));
    const before = loads.length;
    expect(loads.filter(monthChunk)).toEqual([]);

    // Six events of 100 px take 16 px an hour to 16 * exp(-1.2), 4.8, in the 4 weeks band.
    for (let event = 0; event < 6; event += 1) ctrlWheel(gantt, 100);
    const lastEventAt = performance.now();
    // The last frame's zoom is drawn: the header's top tier names ISO weeks, as 4 weeks does.
    await waitFor(() =>
      expect(gantt.querySelector('[data-tier="top"] .sr-only')?.textContent).toMatch(/^Week /),
    );

    await waitFor(() => expect(loads.filter(monthChunk).length).toBeGreaterThan(0));
    await waitFor(() => expect(chunkStatus()).toBe(''));
    // No chunk loaded while the gesture ran: every load after it waited for its end.
    for (const at of loadedAt.slice(before)) expect(at - lastEventAt).toBeGreaterThanOrEqual(150);
    const months = loads.filter(monthChunk);
    expect(new Set(months).size).toBe(months.length);
  });
});
