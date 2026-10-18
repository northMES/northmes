// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';

const week45 = {
  from: '2026-11-01T23:00:00Z',
  to: '2026-11-08T23:00:00Z',
  filter: {},
};

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
      '1006',
    ]);
    expect(snapshot.productionOrders.flatMap((order) => order.jobOrders)).toHaveLength(8);
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

  it('GT1 GT2 fills the float of the rows of 1001 and 1003 from the expected values', async () => {
    const { analysis } = await g1DataSource.load(week45);

    expect(analysis.jobOrders['jo-1001-20']?.float).toMatchObject({
      waitWorkingS: 0,
      totalFloatWorkingS: 43_200,
      freeFloatWorkingS: 900,
      binding: { kind: 'release', boundBy: '1001.10' },
      critical: false,
      latestStartMs: Date.UTC(2026, 10, 5, 12, 15),
    });
    expect(analysis.jobOrders['jo-1003-10']?.float).toMatchObject({
      totalFloatWorkingS: -900,
      freeFloatWorkingS: 0,
      binding: { kind: 'machine', boundBy: '1001.10', equipment: 'CNC1' },
      critical: true,
    });
    // The locked 1002.10 ends at its deadline: a just-in-time row with zero float, bound by its lock.
    expect(analysis.jobOrders['jo-1002-10']?.float).toMatchObject({
      binding: { kind: 'hardLock' },
      totalFloatWorkingS: 0,
      critical: true,
    });
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

  it('GT1 GT2 fills each order with its slack or late-by and the chain of 1001 and 1003', async () => {
    const { analysis } = await g1DataSource.load(week45);

    expect(analysis.orders['po-1001']).toMatchObject({
      late: false,
      slackElapsedS: 101_700,
      plannedStartMs: Date.UTC(2026, 10, 3, 10, 30),
      plannedEndMs: Date.UTC(2026, 10, 5, 9, 45),
    });
    expect(analysis.orders['po-1001']?.chain?.rows.map((row) => row.row)).toEqual([
      '1001.20',
      '1001.10',
    ]);
    expect(analysis.orders['po-1003']).toMatchObject({
      late: true,
      slackElapsedS: -54_900,
      lateByWorking: { seconds: 900, equipment: 'MILL1' },
      plannedEndMs: Date.UTC(2026, 10, 5, 5, 15),
    });
    expect(analysis.orders['po-1003']?.chain?.rows).toEqual([
      expect.objectContaining({ row: '1003.20', jobOrderId: 'jo-1003-20', critical: true }),
      expect.objectContaining({ row: '1003.10', jobOrderId: 'jo-1003-10', critical: true }),
      expect.objectContaining({
        row: '1001.10',
        orderId: 'po-1001',
        root: true,
        otherOrder: '1001',
      }),
    ]);
    expect(analysis.orders['po-1002']).toMatchObject({ late: false, slackElapsedS: 0 });
  });

  it('GT5 carries the workload buckets of week 45', async () => {
    const { analysis } = await g1DataSource.load(week45);

    // The seven production days whose start lies in week 45, the closed weekend included.
    expect(analysis.workload).toHaveLength(21);
    expect(
      analysis.workload.find((b) => b.equipment === 'CNC1' && b.label === '2026-11-05'),
    ).toMatchObject({ loadedS: 29_700, utilizationPermille: 1000 });
    expect(
      analysis.workload.find((b) => b.equipment === 'CNC1' && b.label === '2026-11-07'),
    ).toMatchObject({ availableS: 0, utilizationPermille: null });
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
