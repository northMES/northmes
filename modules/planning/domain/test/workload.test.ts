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

  it('overtime added inside a committed span never inflates the load: the run is capped at its planned seconds', () => {
    // The 11:00 to 11:30 break of Wed 4 Nov becomes plant-wide overtime after 1003.10 was placed
    // across it: the span now holds 16 200 working seconds, the row still loads its 14 400.
    const overtime = {
      ...g1,
      calendar: {
        ...g1.calendar,
        deviations: [
          {
            kind: 'overtime' as const,
            startsLocal: '2026-11-04T11:00',
            endsLocal: '2026-11-04T11:30',
          },
        ],
      },
    };
    const bucket = workload(g1PlanContext(overtime), days).find(
      (each) => each.equipment === 'CNC1' && each.label === '2026-11-04',
    );

    expect(bucket).toMatchObject({
      availableS: 31_500,
      loadedS: 21_600,
      runS: 21_600,
      overloadS: 0,
      items: [
        { jobOrder: '1001.10', seconds: 7200 },
        { jobOrder: '1003.10', seconds: 14_400 },
      ],
    });
  });

  it('work in closed time counts in the bucket where the last laid segment ends, also at a bucket boundary', () => {
    // 1006.10 committed Fri 13:00 to 15:30 after a calendar change: 7 200 s lie in the shift and
    // 3 600 s past its end. The shift bucket ends at 15:00, exactly where the last segment ends.
    const order = orderOf('1006');
    const past: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({
        ...row,
        placement: {
          setupStartMs: Date.UTC(2026, 10, 6, 12),
          runStartMs: Date.UTC(2026, 10, 6, 12),
          endMs: Date.UTC(2026, 10, 6, 14, 30),
        },
      })),
    };
    const shifts = shiftBuckets(calendar, Date.UTC(2026, 10, 5, 23), Date.UTC(2026, 10, 6, 23));
    const friday = workload(withOrder(past), shifts).find((each) => each.equipment === 'MILL1');

    expect(friday).toMatchObject({ label: '2026-11-06 06:00 to 15:00', overloadS: 3600 });
    expect(friday?.items.find((item) => item.jobOrder === '1006.10')).toEqual({
      jobOrder: '1006.10',
      seconds: 7200,
    });
  });

  it('a row placed wholly in closed time counts its planned seconds as closed in the bucket of its start', () => {
    const order = orderOf('1006');
    const weekend: PlanOrder = {
      ...order,
      jobOrders: order.jobOrders.map((row) => ({
        ...row,
        placement: {
          setupStartMs: Date.UTC(2026, 10, 7, 9),
          runStartMs: Date.UTC(2026, 10, 7, 9),
          endMs: Date.UTC(2026, 10, 7, 12),
        },
      })),
    };
    const buckets = productionDayBuckets({
      timeZone,
      productionDayStart: '06:00',
      fromMs: Date.UTC(2026, 10, 6, 5),
      toMs: Date.UTC(2026, 10, 8, 5),
    });
    const saturday = workload(withOrder(weekend), buckets).find(
      (each) => each.equipment === 'MILL1' && each.label === '2026-11-07',
    );

    expect(saturday).toMatchObject({
      availableS: 0,
      loadedS: 0,
      overloadS: 10_800,
      utilizationPermille: null,
      items: [],
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
