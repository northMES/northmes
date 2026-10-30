// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  GanttChunk,
  GanttJobOrder,
  ZoomLevel,
} from '../../../src/modules/planning/gantt-data.ts';
import { PlanningRefusal } from '../../../src/modules/planning/planning-preview.ts';
import type { TimeRange } from '../../../src/modules/planning/timeline/time-scale.ts';
import {
  type TimeChunksInput,
  useTimeChunks,
} from '../../../src/modules/planning/timeline/use-time-chunks.ts';

afterEach(cleanup);

const zone = 'Europe/Stockholm';
const day = 86_400_000;
/** Mon 2 Nov 2026 00:00 in Stockholm, the start of W45. */
const w45 = Date.UTC(2026, 10, 1, 23);

/** A job order placed at an instant, as a chunk answers it. */
function placedAt(id: string, ms: number): GanttJobOrder {
  return {
    id,
    orderId: 'po-1',
    operationId: '1.10',
    displayNumber: '1.10',
    equipment: 'CNC1',
    quantity: 1,
    status: 'planned',
    plannedSetupS: 0,
    plannedRunS: 3600,
    rates: {
      cycleSeconds: 1,
      piecesPerCycle: 1,
      cyclesPerPiece: 1,
      planningFactor: 1,
      retoolSeconds: 0,
      fixedSeconds: 0,
    },
    placement: { setupStartMs: ms, runStartMs: ms, endMs: ms + 3_600_000, segments: [] },
  };
}

/** A chunk source that counts the loads of each chunk start and answers one job order per day. */
function countingLoad(fail: (fromIso: string) => Error | undefined = () => undefined) {
  const loads: string[] = [];
  const load = async (from: string, to: string): Promise<GanttChunk> => {
    loads.push(from);
    const error = fail(from);
    if (error !== undefined) throw error;
    const jobOrders: GanttJobOrder[] = [];
    for (let ms = Date.parse(from); ms < Date.parse(to); ms += day) {
      jobOrders.push(placedAt(`jo-${ms}`, ms + 8 * 3_600_000));
    }
    return { jobOrders };
  };
  return { load, loads };
}

/** A buffer of three days with the middle one in view, from a day after the start of W45. */
function at(dayIndex: number): { buffer: TimeRange; view: TimeRange } {
  const fromMs = w45 + dayIndex * day;
  return {
    buffer: { fromMs, toMs: fromMs + 3 * day },
    view: { fromMs: fromMs + day, toMs: fromMs + 2 * day },
  };
}

function renderChunks(
  input: Partial<TimeChunksInput> & Pick<TimeChunksInput, 'load'>,
  zoom: ZoomLevel = 'week',
) {
  const base: TimeChunksInput = { zoom, timeZone: zone, ...at(0), ...input };
  return {
    base,
    view: renderHook((props: TimeChunksInput) => useTimeChunks(props), { initialProps: base }),
  };
}

describe('ADR0089 useTimeChunks (Loading by time chunk)', () => {
  it('ADR0089 loads the chunks the buffer touches and one ahead on each side, the chunk in view first, and merges their job orders', async () => {
    const { load, loads } = countingLoad();
    const { view } = renderChunks({ load, ...at(2) });

    await waitFor(() =>
      expect(view.result.current.chunks.every((c) => c.status === 'loaded')).toBe(true),
    );
    expect(loads.map((from) => from.slice(0, 10))).toEqual([
      '2026-11-01',
      '2026-10-25',
      '2026-11-08',
    ]);
    expect(view.result.current.jobOrders).toHaveLength(21);
  });

  it('ADR0089 loads each chunk once while the buffer crosses four chunks, and nothing when it goes back within two buffer widths', async () => {
    const { load, loads } = countingLoad();
    const { view, base } = renderChunks({ load });
    const settle = () =>
      waitFor(() =>
        expect(view.result.current.chunks.some((c) => c.status === 'loading')).toBe(false),
      );
    for (const dayIndex of [0, 5, 10, 15, 20]) {
      view.rerender({ ...base, ...at(dayIndex) });
      await settle();
    }
    // W45 to W48 crossed, with W44 and W49 one ahead.
    expect(loads).toHaveLength(6);
    expect(new Set(loads).size).toBe(6);

    for (const dayIndex of [17, 14]) {
      view.rerender({ ...base, ...at(dayIndex) });
      await settle();
    }
    expect(loads).toHaveLength(6);
  });

  it('ADR0089 drops a chunk more than two buffer widths away, unless it holds a job order the view keeps, and loads it again when it comes back', async () => {
    const { load, loads } = countingLoad();
    const kept = `jo-${w45 + 2 * day}`;
    const { view, base } = renderChunks({ load, keep: new Set([kept]) });
    await waitFor(() => expect(view.result.current.jobOrders.length).toBeGreaterThan(0));

    // Six weeks later: W44 and W46 lie far behind, W45 holds the kept job order.
    view.rerender({ ...base, ...at(42) });
    await waitFor(() =>
      expect(view.result.current.chunks.some((c) => c.status === 'loading')).toBe(false),
    );
    const keys = view.result.current.chunks.map((chunk) => chunk.key);
    expect(keys).toContain('2026-W45');
    expect(keys).not.toContain('2026-W44');
    expect(view.result.current.jobOrders.map((row) => row.id)).toContain(kept);

    const before = loads.length;
    view.rerender({ ...base, ...at(0) });
    await waitFor(() =>
      expect(view.result.current.chunks.some((c) => c.status === 'loading')).toBe(false),
    );
    expect(loads.slice(before).map((from) => from.slice(0, 10))).toEqual([
      '2026-10-25',
      '2026-11-08',
    ]);
  });

  it('ADR0089 marks a chunk that fails as failed and loads it again on Try again', async () => {
    let failing = true;
    const { load, loads } = countingLoad((from) =>
      failing && from.startsWith('2026-11-01')
        ? new Error('The plan server did not answer')
        : undefined,
    );
    const { view } = renderChunks({ load });
    await waitFor(() =>
      expect(view.result.current.chunks.find((c) => c.key === '2026-W45')?.status).toBe('failed'),
    );

    failing = false;
    act(() => view.result.current.retry(['2026-W45']));

    await waitFor(() =>
      expect(view.result.current.chunks.find((c) => c.key === '2026-W45')?.status).toBe('loaded'),
    );
    expect(loads.filter((from) => from.startsWith('2026-11-01'))).toHaveLength(2);
  });

  it('ADR0089 marks a chunk the source refuses as too large', async () => {
    const { load } = countingLoad((from) =>
      from.startsWith('2026-11-01')
        ? new PlanningRefusal('planning.board.range_too_large')
        : undefined,
    );
    const { view } = renderChunks({ load });

    await waitFor(() =>
      expect(view.result.current.chunks.find((c) => c.key === '2026-W45')?.status).toBe('refused'),
    );
  });

  it('ADR0089 loads the buffer again at a level whose chunk is longer, and again when the source changes', async () => {
    const first = countingLoad();
    const { view, base } = renderChunks({ load: first.load });
    await waitFor(() => expect(first.loads).toHaveLength(3));

    view.rerender({ ...base, zoom: '4weeks' });
    await waitFor(() => expect(view.result.current.chunks.map((c) => c.key)).toContain('2026-11'));
    expect(first.loads.slice(3).map((from) => from.slice(0, 10))).toEqual([
      '2026-10-31',
      '2026-09-30',
      '2026-11-30',
    ]);

    const second = countingLoad();
    view.rerender({ ...base, zoom: '4weeks', load: second.load });
    await waitFor(() => expect(second.loads).toHaveLength(3));
  });

  it('ADR0089 keeps drawing the job orders of the source before while a new source loads its chunks again', async () => {
    const first = countingLoad();
    const { view, base } = renderChunks({ load: first.load });
    await waitFor(() => expect(view.result.current.jobOrders).toHaveLength(21));

    let answer: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const second = countingLoad();
    const slow: TimeChunksInput['load'] = async (from, to) => {
      await waiting;
      return second.load(from, to);
    };
    view.rerender({ ...base, load: slow });

    expect(view.result.current.jobOrders).toHaveLength(21);
    expect(view.result.current.chunks.every((chunk) => chunk.status === 'loaded')).toBe(true);
    answer();
    await waitFor(() => expect(second.loads).toHaveLength(3));
  });

  it('ADR0089 keeps drawing the job orders of the level before in every render while the chunks of a shorter level load, so a focused block stays', async () => {
    let held: Promise<void> | undefined;
    let answer: () => void = () => {};
    const counting = countingLoad();
    const load: TimeChunksInput['load'] = async (from, to) => {
      if (held !== undefined) await held;
      return counting.load(from, to);
    };
    // Every render's job orders, since one render without a block unmounts it and drops its focus.
    const drawn: string[][] = [];
    const base: TimeChunksInput = { load, zoom: '4weeks', timeZone: zone, ...at(0) };
    const view = renderHook(
      (props: TimeChunksInput) => {
        const chunks = useTimeChunks(props);
        drawn.push(chunks.jobOrders.map((row) => row.id).sort());
        return chunks;
      },
      { initialProps: base },
    );
    await waitFor(() =>
      expect(view.result.current.chunks.every((chunk) => chunk.status === 'loaded')).toBe(true),
    );
    const before = view.result.current.jobOrders.map((row) => row.id).sort();
    expect(before.length).toBeGreaterThan(21);

    held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const fromRender = drawn.length;
    view.rerender({ ...base, zoom: 'week' });

    expect(view.result.current.chunks.some((chunk) => chunk.status === 'loading')).toBe(true);
    expect(drawn.slice(fromRender).every((ids) => ids.join() === before.join())).toBe(true);

    answer();
    await waitFor(() =>
      expect(view.result.current.chunks.every((chunk) => chunk.status === 'loaded')).toBe(true),
    );
    // The weeks' answers replace what the months drew.
    expect(view.result.current.jobOrders).toHaveLength(21);
  });

  it('ADR0089 takes no answer of a chunk that started before the plant zone changed', async () => {
    let answer: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const counted = countingLoad();
    // The loads in UTC wait until the plant zone has arrived; the plant zone's answer at once.
    let holding = true;
    const slowFirst: TimeChunksInput['load'] = async (from, to) => {
      if (holding) await waiting;
      return counted.load(from, to);
    };
    const { view, base } = renderChunks({ load: slowFirst, timeZone: 'UTC' });
    await waitFor(() => expect(view.result.current.chunks.length).toBeGreaterThan(0));

    holding = false;
    view.rerender({ ...base, load: slowFirst, timeZone: zone });
    await waitFor(() =>
      expect(view.result.current.chunks.every((chunk) => chunk.status === 'loaded')).toBe(true),
    );
    answer();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Every chunk is the plant zone's: aligned to Stockholm's Monday midnight.
    expect(
      view.result.current.chunks.map((chunk) => new Date(chunk.fromMs).toISOString()),
    ).toContain('2026-11-01T23:00:00.000Z');
    expect(view.result.current.chunks.some((chunk) => chunk.fromMs === Date.UTC(2026, 10, 2))).toBe(
      false,
    );
  });

  it('ADR0089 keeps a chunk answer that arrives while the buffer moves', async () => {
    const pending: (() => void)[] = [];
    const counted = countingLoad();
    const held: TimeChunksInput['load'] = async (from, to) => {
      await new Promise<void>((resolve) => pending.push(resolve));
      return counted.load(from, to);
    };
    const { view, base } = renderChunks({ load: held });
    await waitFor(() => expect(pending).toHaveLength(3));

    act(() => {
      for (const resolve of pending.splice(0)) resolve();
      view.rerender({ ...base, load: held, ...at(4) });
    });

    await waitFor(() =>
      expect(view.result.current.chunks.find((c) => c.key === '2026-W45')?.status).toBe('loaded'),
    );
  });
});
