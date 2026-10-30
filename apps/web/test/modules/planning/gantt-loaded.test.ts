// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { noEnteredOrders } from '../../../src/modules/planning/entered-orders.ts';
import { g1DataSource, ganttPageSize } from '../../../src/modules/planning/gantt-data.ts';
import { loadedSnapshot } from '../../../src/modules/planning/gantt-loaded.ts';
import { boardModelOf } from '../../../src/modules/planning/screens/board/board-rows.ts';
import {
  buildGanttRows,
  jobOrderRowsOf,
  notPlacedRows,
  summarySpan,
} from '../../../src/modules/planning/screens/gantt/gantt-rows.ts';

const w45 = { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 8, 23) };
const iso = (ms: number) => new Date(ms).toISOString();

/** The row list of G1 with one order entered by hand, which has no machine yet. */
async function rowsWithEntered() {
  return g1DataSource.loadRows(
    {},
    { first: ganttPageSize },
    {
      entered: {
        ...noEnteredOrders,
        productionOrders: [
          {
            plant: 'pyr',
            number: 'N-1007',
            article: 'Gear blank 32',
            quantity: 10,
            deadlineDate: '2026-11-20',
            priority: null,
            color: 'palette-1',
            suppliedLines: [],
            createdAtMs: Date.UTC(2026, 10, 1),
            createdBy: 'planner',
          },
        ],
      },
    },
  );
}

describe('ADR0089 the plan of the loaded rows and chunks', () => {
  it('ADR0089 takes each placement from the loaded chunks and marks a placed job order whose chunk is not loaded as awaiting it', async () => {
    const rows = await rowsWithEntered();
    const w45Chunk = await g1DataSource.loadChunk(iso(w45.fromMs), iso(w45.toMs), {});

    const snapshot = loadedSnapshot(rows.frame, rows.orders, w45Chunk.jobOrders, w45);
    const jobOrders = snapshot.productionOrders.flatMap((order) => order.jobOrders);

    expect(jobOrders.find((row) => row.id === 'jo-1001-10')?.placement?.setupStartMs).toBe(
      Date.UTC(2026, 10, 3, 10, 30),
    );
    // 1005 lies in week 46, whose chunk is not loaded.
    const waiting = jobOrders.find((row) => row.displayNumber === '1005.10');
    expect(waiting?.placement).toBeUndefined();
    expect(waiting?.awaitingPlacement).toBe(true);
    // An order entered by hand has no machine, so it is not placed and awaits nothing.
    const entered = jobOrders.filter((row) => row.orderId === 'po-N-1007');
    expect(entered.length).toBeGreaterThan(0);
    expect(entered.every((row) => row.awaitingPlacement === undefined)).toBe(true);
    expect(snapshot.analysis.orders['po-1001']).toBeDefined();
  });

  it('ADR0089 puts only the job orders without a machine in the Not placed row, on the Gantt and on the board', async () => {
    const rows = await rowsWithEntered();
    const snapshot = loadedSnapshot(rows.frame, rows.orders, [], w45);

    const gantt = notPlacedRows(buildGanttRows(snapshot)).map((row) => row.jobOrder.orderId);
    const board = boardModelOf(snapshot, w45).notPlaced.map((row) => row.jobOrder.orderId);

    expect(new Set(gantt)).toEqual(new Set(['po-N-1007']));
    expect(new Set(board)).toEqual(new Set(['po-N-1007']));
  });

  it('ADR0089 keeps the span of an order from the row list while its job orders await their chunks', async () => {
    const rows = await rowsWithEntered();
    const snapshot = loadedSnapshot(rows.frame, rows.orders, [], w45);

    const order1005 = buildGanttRows(snapshot).find(
      (row) => row.kind === 'order' && row.order.number === '1005',
    );

    if (order1005?.kind !== 'order') throw new Error('No row for order 1005');
    // 1005 starts on Mon 9 Nov 06:00 in week 46, as G1 places it.
    const span = summarySpan(jobOrderRowsOf(order1005));
    expect(span?.fromMs).toBe(Date.UTC(2026, 10, 9, 5, 0));
    expect(span).toEqual(rows.orders.find((order) => order.number === '1005')?.span);
  });
});
