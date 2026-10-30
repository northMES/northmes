// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { CombinedGraphQLErrors } from '@apollo/client';
import { describe, expect, it } from 'vitest';
import {
  type EnteredOrders,
  type EnteredProductionOrder,
  noEnteredOrders,
} from '../../../src/modules/planning/entered-orders.ts';
import {
  type GanttLoadOptions,
  g1DataSource,
  ganttMaxOrders,
  ganttPageSize,
} from '../../../src/modules/planning/gantt-data.ts';
import {
  isPlanningRefusal,
  PlanningForbidden,
} from '../../../src/modules/planning/planning-preview.ts';

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

const w45 = { from: '2026-11-01T23:00:00Z', to: '2026-11-08T23:00:00Z' };

/** Production orders entered by hand, numbered 9000 on, with a deadline after G1's. */
function enteredOrders(count: number, fields: Partial<EnteredProductionOrder> = {}): EnteredOrders {
  return {
    ...noEnteredOrders,
    productionOrders: Array.from({ length: count }, (_, index) => ({
      plant: 'pyr',
      number: `9${String(index).padStart(4, '0')}`,
      article: 'A-100',
      quantity: 10,
      deadlineDate: '2026-11-20',
      priority: null,
      color: 'palette-1',
      suppliedLines: [],
      createdAtMs: Date.UTC(2026, 10, 1),
      createdBy: 'planner',
      ...fields,
    })),
  };
}

describe('g1DataSource rows and chunks (ADR 0089, Loading by time chunk)', () => {
  it('ADR0089 answers the row list in the autoplan order, each job order without its placement and each order with its span', async () => {
    const page = await g1DataSource.loadRows({}, { first: ganttPageSize });

    expect(page.totalCount).toBe(6);
    expect(page.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: false });
    expect(page.frame.fixture).toBe('G1');
    expect(page.frame.nowMs).toBe(Date.UTC(2026, 10, 2, 8, 40));
    expect(page.orders.map((order) => order.number)).toEqual([
      '1003',
      '1002',
      '1001',
      '1004',
      '1005',
      '1006',
    ]);
    const jobOrders = page.orders.flatMap((order) => order.jobOrders);
    expect(jobOrders).toHaveLength(10);
    expect(jobOrders.every((row) => row.placement === undefined)).toBe(true);
    expect(jobOrders.every((row) => row.equipment !== undefined)).toBe(true);
    expect(page.orders.find((order) => order.number === '1006')?.span).toEqual({
      fromMs: Date.UTC(2026, 10, 6, 12, 0),
      toMs: Date.UTC(2026, 10, 9, 6, 0),
    });
  });

  it('ADR0089 puts an order of a higher priority first among orders of one deadline, as the tree does', async () => {
    // 1001 and 1004 share a deadline at priorities 2 and 3; an order at priority 1 comes before.
    const deadline = { deadlineDate: '2026-11-06', deadlineTime: '15:00', priority: 1 };
    const page = await g1DataSource.loadRows(
      {},
      { first: ganttPageSize },
      { entered: enteredOrders(1, deadline) },
    );

    expect(page.orders.map((order) => order.number).slice(2, 5)).toEqual(['90000', '1001', '1004']);
  });

  it('ADR0089 gives an order with nothing placed no span, and its job orders no machine', async () => {
    const page = await g1DataSource.loadRows(
      {},
      { first: ganttPageSize },
      { entered: enteredOrders(1) },
    );
    const entered = page.orders.find((order) => order.number === '90000');

    expect(entered?.span).toBeUndefined();
    expect(entered?.jobOrders.every((row) => row.equipment === undefined)).toBe(true);
  });

  it('ADR0016 pages forward with first and after, and backward with last and before', async () => {
    const first = await g1DataSource.loadRows({}, { first: 4 });
    const second = await g1DataSource.loadRows({}, { first: 4, after: first.pageInfo.endCursor });
    const last = await g1DataSource.loadRows({}, { last: 4 });
    const before = await g1DataSource.loadRows({}, { last: 4, before: last.pageInfo.startCursor });

    expect(first.orders.map((order) => order.number)).toEqual(['1003', '1002', '1001', '1004']);
    expect(first.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
    expect(second.orders.map((order) => order.number)).toEqual(['1005', '1006']);
    expect(second.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });
    expect(second.totalCount).toBe(6);
    expect(last.orders.map((order) => order.number)).toEqual(['1001', '1004', '1005', '1006']);
    expect(last.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: true });
    expect(before.orders.map((order) => order.number)).toEqual(['1003', '1002']);
    expect(before.pageInfo).toMatchObject({ hasPreviousPage: false });
  });

  it('ADR0016 refuses a page size outside 1 to 100 and a cursor it never gave', async () => {
    expect(ganttPageSize).toBe(100);
    for (const page of [{ first: 0 }, { first: -1 }, { first: 101 }, { last: 101 }]) {
      await expect(g1DataSource.loadRows({}, page)).rejects.toSatisfy((error: unknown) =>
        isPlanningRefusal(error, 'core.list.bad_argument'),
      );
    }
    for (const after of ['abc', '', '-5', '1.5', '6']) {
      await expect(g1DataSource.loadRows({}, { first: 4, after })).rejects.toSatisfy(
        (error: unknown) => isPlanningRefusal(error, 'core.list.invalid_cursor'),
      );
    }
  });

  it('ADR0016 searches order numbers as a case-insensitive substring', async () => {
    const page = await g1DataSource.loadRows(
      { search: ' n-9 ' },
      { first: ganttPageSize },
      { entered: enteredOrders(1, { number: 'N-9001' }) },
    );

    expect(page.orders.map((order) => order.number)).toEqual(['N-9001']);
    expect(page.totalCount).toBe(1);
  });

  it('ADR0089 refuses a row list above 1 250 orders with planning.gantt.too_many_orders on its first page', async () => {
    expect(ganttMaxOrders).toBe(1_250);
    // G1 has 6 orders.
    const atLimit = await g1DataSource.loadRows(
      {},
      { first: ganttPageSize },
      { entered: enteredOrders(1_244) },
    );
    expect(atLimit.totalCount).toBe(1_250);

    const refused = g1DataSource.loadRows(
      {},
      { first: ganttPageSize },
      { entered: enteredOrders(1_245) },
    );

    await expect(refused).rejects.toSatisfy((error: unknown) =>
      isPlanningRefusal(error, 'planning.gantt.too_many_orders'),
    );
  });

  it('ADR0089 answers a chunk with the job orders whose span overlaps it, placements included', async () => {
    const chunk = await g1DataSource.loadChunk(w45.from, w45.to, {});

    // 1005 lies in week 46 alone.
    expect(chunk.jobOrders.map((row) => row.displayNumber)).not.toContain('1005.10');
    expect(chunk.jobOrders).toHaveLength(8);
    expect(chunk.jobOrders.find((row) => row.id === 'jo-1001-10')?.placement?.setupStartMs).toBe(
      Date.UTC(2026, 10, 3, 10, 30),
    );
  });

  it('ADR0089 answers 1006.10 in both ISO weeks it touches, and nothing for a week without placements', async () => {
    const w45Chunk = await g1DataSource.loadChunk(w45.from, w45.to, {});
    const w46 = await g1DataSource.loadChunk('2026-11-08T23:00:00Z', '2026-11-15T23:00:00Z', {});
    const w48 = await g1DataSource.loadChunk('2026-11-22T23:00:00Z', '2026-11-29T23:00:00Z', {});

    expect(w45Chunk.jobOrders.map((row) => row.displayNumber)).toContain('1006.10');
    expect(w46.jobOrders.map((row) => row.displayNumber)).toEqual([
      '1005.10',
      '1005.20',
      '1006.10',
    ]);
    expect(w48.jobOrders).toEqual([]);
  });

  it('DR17 DR18 DR20 DR22 answers each page state of the preview for rows and chunks alike', async () => {
    const reads = {
      rows: (options: GanttLoadOptions) =>
        g1DataSource.loadRows({}, { first: ganttPageSize }, options),
      chunk: (options: GanttLoadOptions) => g1DataSource.loadChunk(w45.from, w45.to, {}, options),
    };
    for (const read of Object.values(reads)) {
      await expect(read({ preview: 'error' })).rejects.toThrow('The plan could not be loaded');
      await expect(read({ preview: 'forbidden' })).rejects.toBeInstanceOf(PlanningForbidden);
      const loading = await Promise.race([
        read({ preview: 'loading' }).then(() => 'answered'),
        new Promise((resolve) => setTimeout(() => resolve('waiting'), 20)),
      ]);
      expect(loading).toBe('waiting');
    }
    const empty = await reads.rows({ preview: 'empty' });
    expect(empty.frame.equipment.every((machine) => !machine.isPlannable)).toBe(true);
    expect((await reads.chunk({ preview: 'empty' })).jobOrders).toHaveLength(8);
  });
});

describe('isPlanningRefusal (ADR 0012)', () => {
  it('reads the errorCode of the API as it reads the refusal of a mock source', () => {
    const fromApi = new CombinedGraphQLErrors({
      data: null,
      errors: [
        {
          message: 'Too many orders',
          extensions: { code: 'BAD_REQUEST', errorCode: 'planning.gantt.too_many_orders' },
        },
      ],
    });

    expect(isPlanningRefusal(fromApi, 'planning.gantt.too_many_orders')).toBe(true);
    expect(isPlanningRefusal(fromApi, 'core.list.invalid_cursor')).toBe(false);
    expect(
      isPlanningRefusal(
        new Error('planning.gantt.too_many_orders'),
        'planning.gantt.too_many_orders',
      ),
    ).toBe(false);
  });
});
