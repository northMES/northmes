// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';

const week45 = {
  from: '2026-11-01T23:00:00Z',
  to: '2026-11-08T23:00:00Z',
  filter: {},
};

// The floats, chains, slack and workload of G1 are compared whole with g1.expected.json in
// gantt-analysis.test.ts; this file pins what the source adds: the epoch conversion, a load of a
// later week, the segments, the release and the constraint lines.
describe('g1DataSource (plan 18, Data loading)', () => {
  it('GT1 answers the fixture G1 with every instant as epoch milliseconds', async () => {
    const snapshot = await g1DataSource.load(week45);

    expect(snapshot.fixture).toBe('G1');
    expect(snapshot.plant.timeZone).toBe('Europe/Stockholm');
    expect(snapshot.nowMs).toBe(Date.UTC(2026, 10, 2, 8, 40));
    expect(snapshot.fenceMs).toBe(Date.UTC(2026, 10, 3, 8, 40));
    expect(snapshot.productionOrders.map((order) => order.number)).toEqual([
      '1001',
      '1002',
      '1003',
      '1004',
      '1005',
      '1006',
    ]);
    expect(snapshot.productionOrders.flatMap((order) => order.jobOrders)).toHaveLength(10);
    const first = snapshot.productionOrders[0]?.jobOrders[0];
    expect(first?.placement?.setupStartMs).toBe(Date.UTC(2026, 10, 3, 10, 30));
    expect(first?.placement?.runStartMs).toBe(Date.UTC(2026, 10, 3, 11, 0));
    expect(first?.placement?.endMs).toBe(Date.UTC(2026, 10, 4, 7, 0));
    expect(snapshot.productionOrders[0]?.deadlineMs).toBe(Date.UTC(2026, 10, 6, 14, 0));
  });

  it('a load of a later week keeps every placement where the fixture puts it, segments included', async () => {
    // Week 47 lies after every G1 placement: the segments still come from the calendar around
    // the placements, not from the requested range.
    const { productionOrders } = await g1DataSource.load({
      from: '2026-11-15T23:00:00Z',
      to: '2026-11-22T23:00:00Z',
      filter: {},
    });
    const row = productionOrders.find((order) => order.number === '1001')?.jobOrders[0];

    expect(row?.placement).toEqual({
      setupStartMs: Date.UTC(2026, 10, 3, 10, 30),
      runStartMs: Date.UTC(2026, 10, 3, 11, 0),
      endMs: Date.UTC(2026, 10, 4, 7, 0),
      segments: [
        { fromMs: Date.UTC(2026, 10, 3, 10, 30), toMs: Date.UTC(2026, 10, 3, 14, 0) },
        { fromMs: Date.UTC(2026, 10, 4, 5, 0), toMs: Date.UTC(2026, 10, 4, 7, 0) },
      ],
    });
  });

  it('GT7 carries the working segments of each placed row, so 1006.10 has one closed gap', async () => {
    const { productionOrders } = await g1DataSource.load(week45);
    const row = productionOrders.find((order) => order.number === '1006')?.jobOrders[0];

    expect(row?.placement?.segments).toEqual([
      { fromMs: Date.UTC(2026, 10, 6, 12, 0), toMs: Date.UTC(2026, 10, 6, 14, 0) },
      { fromMs: Date.UTC(2026, 10, 9, 5, 0), toMs: Date.UTC(2026, 10, 9, 6, 0) },
    ]);
  });

  it('GT1 GT4 sets the release of a successor row: the predecessor end plus the lead time, or the send-ahead instant', async () => {
    const { analysis } = await g1DataSource.load(week45);

    expect(analysis.jobOrders['jo-1001-20']?.release).toEqual({
      fromRow: '1001.10',
      fromJobOrderId: 'jo-1001-10',
      pointMs: Date.UTC(2026, 10, 4, 7, 0),
      atMs: Date.UTC(2026, 10, 4, 8, 0),
    });
    expect(analysis.jobOrders['jo-1004-20']?.release).toEqual({
      fromRow: '1004.10',
      fromJobOrderId: 'jo-1004-10',
      pointMs: Date.UTC(2026, 10, 5, 8, 15),
      atMs: Date.UTC(2026, 10, 5, 8, 45),
    });
    expect(analysis.jobOrders['jo-1001-10']?.release).toBeUndefined();
  });

  it('GT4 lists the constraints of 1004.20 as release, last piece, allowed machines and calendar, each holding', async () => {
    const { analysis } = await g1DataSource.load(week45);
    const lines = analysis.jobOrders['jo-1004-20']?.constraints ?? [];

    expect(lines.map((line) => line.kind)).toEqual([
      'deadline',
      'release',
      'lastPiece',
      'allowedMachines',
      'oneJobAtATime',
      'calendar',
    ]);
    expect(lines.every((line) => line.holds)).toBe(true);
    expect(lines[1]?.text).toBe(
      'Release from 1004.10: Thu 5 Nov 09:45 (300 pieces complete at Thu 5 Nov 09:15, lead 30 min)',
    );
    expect(lines[2]?.text).toContain('Fri 6 Nov 08:45');
    expect(lines[3]?.text).toBe('Allowed machines: Mill 1');
  });

  it('GT2 marks the deadline line of a late order as broken', async () => {
    const { analysis } = await g1DataSource.load(week45);
    const deadline = analysis.jobOrders['jo-1003-20']?.constraints[0];

    expect(deadline).toMatchObject({
      kind: 'deadline',
      holds: false,
      text: 'Deadline of order 1003: Wed 4 Nov 15:00, late by 15 h 15 min',
    });
  });
});
