// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { placeMarkers } from './markers.ts';
import { createTimeScale, rangeOf } from './time-scale.ts';

const stockholm = 'Europe/Stockholm';
const week45 = rangeOf('2026-11-02', 'week', stockholm, '06:00');
const scale = createTimeScale({ range: week45, zoom: 'week', timeZone: stockholm, widthPx: 840 });

describe('placeMarkers (plan 18, Additions the core needs)', () => {
  it('GT9 places a point marker and a band on the scale and drops what lies outside the range', () => {
    const placed = placeMarkers(
      [
        {
          kind: 'deadline',
          atMs: Date.UTC(2026, 10, 4, 14, 0),
          rowId: 'po-1003',
          label: 'Wed 15:00',
          accessibleText: 'deadline Wed 4 Nov 15:00',
        },
        {
          kind: 'lateBand',
          fromMs: Date.UTC(2026, 10, 4, 14, 0),
          toMs: Date.UTC(2026, 10, 5, 5, 15),
          rowId: 'po-1003',
          accessibleText: 'late by 15 h 15 min',
        },
        {
          kind: 'deadline',
          atMs: Date.UTC(2026, 10, 13, 14, 0),
          rowId: 'po-1006',
          accessibleText: 'deadline Fri 13 Nov 15:00',
        },
      ],
      scale,
    );

    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({ kind: 'deadline', x: 315, label: 'Wed 15:00' });
    expect(placed[1]).toMatchObject({ kind: 'lateBand', x: 315, widthPx: 76.25 });
  });

  it('clips a band that crosses the range edge, as the frozen window band does', () => {
    const [band] = placeMarkers(
      [
        {
          kind: 'frozen',
          fromMs: week45.fromMs - 3_600_000,
          toMs: Date.UTC(2026, 10, 3, 8, 40),
          rowId: 'all',
          accessibleText: 'frozen window',
        },
      ],
      scale,
    );

    expect(band).toMatchObject({ x: 0, widthPx: scale.x(Date.UTC(2026, 10, 3, 8, 40)) });
  });

  it('merges point markers of one row within 1 px into one with a combined label', () => {
    const placed = placeMarkers(
      [
        {
          kind: 'latestEnd',
          atMs: Date.UTC(2026, 10, 4, 14, 0),
          rowId: 'jo-1003-20',
          label: 'latest end',
          accessibleText: 'latest end Wed 15:00',
        },
        {
          kind: 'deadline',
          atMs: Date.UTC(2026, 10, 4, 14, 0) + 60_000,
          rowId: 'jo-1003-20',
          label: 'deadline',
          accessibleText: 'deadline Wed 15:00',
        },
        {
          kind: 'deadline',
          atMs: Date.UTC(2026, 10, 4, 14, 0),
          rowId: 'po-1003',
          accessibleText: 'deadline Wed 15:00',
        },
      ],
      scale,
    );

    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({
      label: 'latest end, deadline',
      accessibleText: 'latest end Wed 15:00, deadline Wed 15:00',
    });
    expect(placed[0]?.merged).toHaveLength(2);
  });
});
