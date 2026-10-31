// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ZoomLevel } from '../../../src/modules/planning/gantt-data.ts';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { rowMarkers } from '../../../src/modules/planning/screens/gantt/gantt-marker-layer.tsx';
import { buildGanttRows } from '../../../src/modules/planning/screens/gantt/gantt-rows.ts';
import { TimeCellShading } from '../../../src/modules/planning/screens/gantt/gantt-time-area.tsx';
import {
  createTimeScale,
  naturalWidthPx,
  rangeOf,
} from '../../../src/modules/planning/timeline/time-scale.ts';

afterEach(cleanup);

const stockholm = 'Europe/Stockholm';

describe('the closed time of a row (ADR 0089, Header tiers)', () => {
  it('draws no closed window narrower than one pixel at the level', () => {
    const range = rangeOf('2026-11-01', 'quarter', stockholm, '06:00');
    const scale = createTimeScale({
      range,
      zoom: 'quarter',
      timeZone: stockholm,
      widthPx: naturalWidthPx(range, 'quarter'),
    });
    // A 30 min break is 0.3 px at Quarter; an 8 h night is 4.8 px.
    const lunch = { fromMs: Date.UTC(2026, 10, 4, 11), toMs: Date.UTC(2026, 10, 4, 11, 30) };
    const night = { fromMs: Date.UTC(2026, 10, 4, 21), toMs: Date.UTC(2026, 10, 5, 5) };

    const { container } = render(
      <TimeCellShading windows={[lunch, night]} scale={scale} nowMs={range.fromMs} />,
    );

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-shading]')].map((each) =>
        Number(each.dataset.fromMs),
      ),
    ).toEqual([night.fromMs]);
  });

  it('draws a compressed window the range edge cuts as a gap', () => {
    const range = rangeOf('2026-11-02', 'week', stockholm, '06:00');
    // Sun 1 Nov 22:00 to Mon 2 Nov 06:00: the range starts inside it, at Monday's midnight.
    const night = { fromMs: Date.UTC(2026, 10, 1, 21), toMs: Date.UTC(2026, 10, 2, 5) };
    const hideClosed = { closed: [night] };
    const scale = createTimeScale({
      range,
      zoom: 'week',
      timeZone: stockholm,
      widthPx: naturalWidthPx(range, 'week', hideClosed),
      hideClosed,
    });

    const { container } = render(
      <TimeCellShading windows={[night]} scale={scale} nowMs={range.fromMs} />,
    );

    expect(container.querySelector('[data-shading]')?.getAttribute('data-shading')).toBe('gap');
  });
});

describe('the time before now (ADR 0089, Time before now)', () => {
  const range = rangeOf('2026-11-02', 'week', stockholm, '06:00');
  const scale = createTimeScale({ range, zoom: 'week', timeZone: stockholm, widthPx: 1680 });
  // Mon 2 Nov 09:40 plant time, G1's now.
  const nowMs = Date.UTC(2026, 10, 2, 8, 40);
  const night = { fromMs: Date.UTC(2026, 10, 1, 21), toMs: Date.UTC(2026, 10, 2, 5) };

  it('ADR0089 draws a past tone from the range start to now, behind the closed time', () => {
    const { container } = render(<TimeCellShading windows={[night]} scale={scale} nowMs={nowMs} />);

    const past = container.querySelector<HTMLElement>('[data-past]');
    expect(past?.dataset.toMs).toBe(String(nowMs));
    expect(past?.style.left).toBe('0px');
    // 168 h over 1680 px is 10 px an hour, so 9 h 40 min is 96.667 px.
    expect(Number.parseFloat(past?.style.width ?? '')).toBeCloseTo(96.667, 3);
    // First in the cell, so the closed time and the blocks draw over it.
    expect(container.firstElementChild).toBe(past);
    expect(container.querySelector('[data-shading]')).not.toBeNull();
  });

  it('ADR0089 draws no past tone while now is before the range, and a full one once it is after', () => {
    const before = render(<TimeCellShading windows={[]} scale={scale} nowMs={range.fromMs - 1} />);
    expect(before.container.querySelector('[data-past]')).toBeNull();
    cleanup();

    const after = render(<TimeCellShading windows={[]} scale={scale} nowMs={range.toMs + 1} />);
    expect(after.container.querySelector<HTMLElement>('[data-past]')?.style.width).toBe('1680px');
  });
});

describe("the deadline's time label on the ladder (plan 18; ADR 0089, Zoom levels)", () => {
  const snapshot = g1Snapshot();
  const order = buildGanttRows(snapshot).find((row) => row.kind === 'order');

  function deadlineLabel(zoom: ZoomLevel, from: string): string | undefined {
    if (order === undefined) throw new Error('G1 has an order row');
    const range = rangeOf(from, zoom, stockholm, '06:00');
    const scale = createTimeScale({
      range,
      zoom,
      timeZone: stockholm,
      widthPx: naturalWidthPx(range, zoom),
    });
    const deadline = rowMarkers(order, snapshot, scale, { onChain: false }).find(
      (marker) => marker.kind === 'deadline',
    );
    return deadline?.label;
  }

  it('labels the deadline with its time at Quarter hours, as at Hours and Day, and not at Quarter', () => {
    expect(deadlineLabel('quarter-hours', '2026-11-06')).toMatch(/^\d\d:\d\d$/);
    expect(deadlineLabel('quarter', '2026-11-01')).toBeUndefined();
  });
});
