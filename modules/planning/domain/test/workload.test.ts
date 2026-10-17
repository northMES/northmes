// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  cascade,
  g1,
  g1Expected,
  g1PlanContext,
  isoWeekBuckets,
  type PlanContext,
  type PlanOrder,
  productionDayBuckets,
  shiftBuckets,
  type WorkloadBucket,
  weeklyCalendar,
  workload,
} from '../src/index.ts';

const context = g1PlanContext();
const timeZone = g1.plant.timeZone;
const calendar = weeklyCalendar({ timeZone, ...g1.calendar });

/** Week 45 in plant time, Mon 2 Nov 00:00 to Mon 9 Nov 00:00. */
const week45 = { fromMs: Date.UTC(2026, 10, 1, 23), toMs: Date.UTC(2026, 10, 8, 23) };

/** The five production days of week 45, Mon 06:00 to Sat 06:00. */
const days = productionDayBuckets({
  timeZone,
  productionDayStart: g1.plant.productionDayStart,
  fromMs: Date.UTC(2026, 10, 2, 5),
  toMs: Date.UTC(2026, 10, 7, 5),
});

function orderOf(number: string, from: PlanContext = context): PlanOrder {
  const found = from.orders.find((each) => each.number === number);
  if (found === undefined) throw new Error(`no order ${number}`);
  return found;
}

function withOrder(order: PlanOrder, from: PlanContext = context): PlanContext {
  return { ...from, orders: from.orders.map((each) => (each.id === order.id ? order : each)) };
}

const totalsOf = (buckets: readonly WorkloadBucket[]) =>
  buckets.reduce(
    (sum, bucket) => ({
      availableS: sum.availableS + bucket.availableS,
      loadedS: sum.loadedS + bucket.loadedS,
      setupS: sum.setupS + bucket.setupS,
    }),
    { availableS: 0, loadedS: 0, setupS: 0 },
  );

describe('workload (plan 18, Workload)', () => {
  it('GT5 gives every bucket of the three machines for the five production days of week 45, with the setup split', () => {
    const buckets = workload(context, days);

    expect(
      buckets.map(
        ({
          label,
          equipment,
          availableS,
          loadedS,
          setupS,
          runS,
          utilizationPermille,
          overloadS,
          items,
        }) => ({
          productionDay: label,
          equipment,
          availableS,
          loadedS,
          setupS,
          runS,
          utilizationPermille,
          overloadS,
          items,
        }),
      ),
    ).toEqual(g1Expected.GT5_workload_week45);
  });

  it('GT6 a row of 3 600 s on CNC2 at Thu 12:00 over the locked 1002.10 loads 32 400 s of 29 700 and overloads 2 700 s', () => {
    const extra: PlanOrder = {
      id: 'po-1005',
      number: '1005',
      deadlineMs: Date.UTC(2026, 10, 6, 14),
      priority: null,
      operations: [
        {
          id: '1005.10',
          displayNumber: '1005.10',
          sequence: 10,
          quantity: 60,
          rates: {
            cycleSeconds: 60,
            piecesPerCycle: 1,
            cyclesPerPiece: 1,
            planningFactor: 1,
            retoolSeconds: 0,
            fixedSeconds: 0,
          },
          leadTimeS: 0,
          sendAheadQuantity: 0,
          isLocked: false,
          allowedEquipment: ['CNC2'],
        },
      ],
      jobOrders: [
        {
          id: 'jo-1005-10',
          operationId: '1005.10',
          displayNumber: '1005.10',
          equipment: 'CNC2',
          quantity: 60,
          status: 'planned',
          placement: {
            setupStartMs: Date.UTC(2026, 10, 5, 11),
            runStartMs: Date.UTC(2026, 10, 5, 11),
            endMs: Date.UTC(2026, 10, 5, 12),
          },
          plannedSetupS: 0,
          plannedRunS: 3600,
          rates: {
            cycleSeconds: 60,
            piecesPerCycle: 1,
            cyclesPerPiece: 1,
            planningFactor: 1,
            retoolSeconds: 0,
            fixedSeconds: 0,
          },
        },
      ],
    };
    const bucket = workload({ ...context, orders: [...context.orders, extra] }, days).find(
      (each) => each.equipment === 'CNC2' && each.label === '2026-11-05',
    );

    expect(bucket).toMatchObject({
      availableS: 29_700,
      loadedS: 32_400,
      overloadS: 2700,
      freeS: 0,
    });
    expect(bucket?.items.map((item) => item.jobOrder)).toEqual(['1001.20', '1002.10', '1005.10']);
  });

  it('a bucket with no availability is closed', () => {
    const weekend = productionDayBuckets({
      timeZone,
      productionDayStart: '06:00',
      fromMs: Date.UTC(2026, 10, 7, 5),
      toMs: Date.UTC(2026, 10, 8, 5),
    });
    const bucket = workload(context, weekend).find((each) => each.equipment === 'CNC1');

    expect(bucket).toMatchObject({
      label: '2026-11-07',
      availableS: 0,
      loadedS: 0,
      utilizationPermille: null,
    });
  });

  it('draft positions count and the committed positions of moved rows do not', () => {
    const moved = cascade(
      orderOf('1003'),
      { jobOrderId: 'jo-1003-10', setupStartMs: Date.UTC(2026, 10, 4, 8) },
      context,
    );
    const buckets = workload(withOrder(moved.order), days);
    const mill1 = (day: string) =>
      buckets.find((each) => each.equipment === 'MILL1' && each.label === day);

    expect(mill1('2026-11-04')).toMatchObject({
      loadedS: 5400,
      items: [{ jobOrder: '1003.20', seconds: 5400 }],
    });
    expect(mill1('2026-11-05')).toMatchObject({
      loadedS: 18_580,
      items: [
        { jobOrder: '1003.20', seconds: 3600 },
        { jobOrder: '1004.20', seconds: 14_980 },
      ],
    });
  });

  it('buckets by shift and by ISO week sum to the same totals as buckets by production day', () => {
    const byDay = workload(
      context,
      productionDayBuckets({ timeZone, productionDayStart: '06:00', ...week45 }),
    );
    const byShift = workload(context, shiftBuckets(calendar, week45.fromMs, week45.toMs));
    const byWeek = workload(context, isoWeekBuckets({ timeZone, ...week45 }));

    expect(byWeek.map((bucket) => bucket.label)).toEqual(['2026-W45', '2026-W45', '2026-W45']);
    expect(byShift.filter((bucket) => bucket.equipment === 'CNC1')).toHaveLength(5);
    expect(byShift[0]).toMatchObject({ label: '2026-11-02 06:00 to 15:00', availableS: 29_700 });
    expect(totalsOf(byShift)).toEqual(totalsOf(byDay));
    expect(totalsOf(byWeek)).toEqual(totalsOf(byDay));
    expect(totalsOf(byDay)).toEqual({ availableS: 3 * 5 * 29_700, loadedS: 160_800, setupS: 3600 });
  });
});
