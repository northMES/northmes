// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { g1, g1Expected, timePoint } from '../../src/fixtures/gantt.ts';
import { addWork, availabilityOf, weeklyCalendar } from '../../src/index.ts';

/**
 * The fixture G1 of docs/plan/18-gantt-timeline.md: a synthetic plant week that every Gantt
 * function is tested against. Both files come from one calculator script, so this test guards
 * their internal consistency, not the calendar arithmetic; their shapes are the ones
 * src/fixtures/gantt.ts parses them with. The regeneration guard lays every placement again with
 * addWork over the A1 calendar, so the files cannot drift from the calendar kernel.
 */

/** The case keys of plan 18 that each Gantt function's first failing test reads. */
const caseKeys = [
  'GT1_float_1001',
  'GT2_late_chain_1003',
  'GT3_cascade_1003',
  'GT4_send_ahead_last_piece_1004',
  'GT1_GT2_floats',
  'GT1_chain_1001',
  'GT2_chain_1003',
  'GT5_workload_week45',
  'GT6_overload_definition',
  'GT7_calendar_span_1006',
  'GT8_frozen_window',
  'GT9_deadline_rules',
  'GT10_run_1001_1005',
] as const;

const secondsBetween = (from: string, to: string): number =>
  Temporal.Instant.from(from).until(Temporal.Instant.from(to)).total('seconds');

const toPlantLocal = (at: string, timeZone: string): string =>
  Temporal.Instant.from(at).toZonedDateTimeISO(timeZone).toPlainDateTime().toString();

describe('fixture G1 (plan 18)', () => {
  const data = g1;
  const values = g1Expected;
  const jobOrders = data.productionOrders.flatMap((order) => order.jobOrders);

  it('holds every case key the specification quotes', () => {
    for (const key of caseKeys) {
      expect(values, key).toHaveProperty(key);
    }
  });

  it('writes every plant-local time as the instant in the plant zone', () => {
    const points: Array<{ instant: string; plantLocal: string }> = [data.now, data.fence];
    for (const order of data.productionOrders) {
      points.push(order.deadlineInstant);
    }
    const collectPoints = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) {
          collectPoints(item);
        }
        return;
      }
      if (value === null || typeof value !== 'object') {
        return;
      }
      if ('instant' in value || 'plantLocal' in value) {
        // A malformed pair fails here instead of slipping through as two loose strings.
        points.push(timePoint.parse(value));
        return;
      }
      for (const nested of Object.values(value)) {
        collectPoints(nested);
      }
    };
    collectPoints(values);
    expect(points.length).toBeGreaterThan(40);
    for (const point of points) {
      expect(toPlantLocal(point.instant, data.plant.timeZone)).toBe(point.plantLocal);
    }
  });

  it('places every job order on its segments, from setup start to end, for its planned seconds', () => {
    for (const row of jobOrders) {
      const placed = values.placements[row.productionOrderOperation];
      expect(placed, row.productionOrderOperation).toBeDefined();
      if (!placed) {
        continue;
      }
      expect(placed.start.instant).toBe(row.setupStartAt);
      expect(placed.end.instant).toBe(row.endAt);
      const first = placed.segments[0];
      const last = placed.segments[placed.segments.length - 1];
      expect(first.from).toBe(row.setupStartAt);
      expect(last.to).toBe(row.endAt);
      let previousTo = first.from;
      let working = 0;
      for (const part of placed.segments) {
        expect(secondsBetween(previousTo, part.from)).toBeGreaterThanOrEqual(0);
        const length = secondsBetween(part.from, part.to);
        expect(length).toBeGreaterThan(0);
        working += length;
        previousTo = part.to;
      }
      expect(working).toBe(row.plannedSetupS + row.plannedRunS);
      const duration = values.durations[row.productionOrderOperation];
      expect(duration).toEqual({
        plannedSeconds: row.plannedSetupS + row.plannedRunS,
        setupSeconds: row.plannedSetupS,
        runSeconds: row.plannedRunS,
      });
    }
  });

  it('places every job order where addWork over the A1 calendar places it (the regeneration guard)', () => {
    const calendar = weeklyCalendar({ timeZone: data.plant.timeZone, ...data.calendar });
    const horizon = availabilityOf(
      calendar,
      undefined,
      Date.parse(data.now.instant),
      Date.parse('2026-11-30T00:00:00Z'),
    );
    for (const row of jobOrders) {
      const placed = values.placements[row.productionOrderOperation];
      const laid = addWork(
        horizon,
        Date.parse(row.setupStartAt),
        row.plannedSetupS + row.plannedRunS,
      );
      expect(laid, row.productionOrderOperation).toEqual({
        startMs: Date.parse(placed?.start.instant ?? ''),
        endMs: Date.parse(placed?.end.instant ?? ''),
        segments: placed?.segments.map(({ from, to }) => ({
          fromMs: Date.parse(from),
          toMs: Date.parse(to),
        })),
      });
    }
  });

  it("runs every job order on one of its operation's allowed machines", () => {
    for (const order of data.productionOrders) {
      for (const row of order.jobOrders) {
        const operation = order.operations.find(
          (candidate) => candidate.displayNumber === row.productionOrderOperation,
        );
        expect(operation, row.id).toBeDefined();
        expect(operation?.allowedEquipment).toContain(row.equipment);
        expect(data.equipment.map((machine) => machine.code)).toContain(row.equipment);
      }
    }
  });

  it('GT10 lays the run of 1001 and 1005 with addWork from each moved setup start, directly after 1001.10 with no setup, and the run is due at the earliest deadline', () => {
    const run = values.GT10_run_1001_1005;
    const calendar = weeklyCalendar({ timeZone: data.plant.timeZone, ...data.calendar });
    const horizon = availabilityOf(
      calendar,
      undefined,
      Date.parse(data.now.instant),
      Date.parse('2026-11-30T00:00:00Z'),
    );
    const orders = run.orders.map((number) => {
      const order = data.productionOrders.find((each) => each.number === number);
      expect(order, number).toBeDefined();
      return order;
    });
    expect(new Set(orders.map((order) => order?.article)).size).toBe(1);
    expect([...run.runOrder].sort()).toEqual([...run.orders].sort());
    expect(Date.parse(run.deadline.instant)).toBe(
      Math.min(...orders.map((order) => Date.parse(order?.deadlineInstant.instant ?? ''))),
    );
    // The case holds its three findings before their values are checked, so an emptied array
    // cannot pass the loops below.
    expect(run.early.map((early) => early.order)).toEqual(['1005']);
    expect(run.savedSetups.map((saved) => saved.jobOrder)).toEqual(['1005.10']);
    expect(run.conflicts).toContainEqual(
      expect.objectContaining({ kind: 'OVERLAP', rows: ['1003.10', '1005.10'] }),
    );
    expect(Object.keys(run.moved).sort()).toEqual(['1005.10', '1005.20']);
    for (const early of run.early) {
      const order = data.productionOrders.find((each) => each.number === early.order);
      expect(order?.deadlineInstant).toEqual(early.deadline);
      expect(early.earlyByElapsedS).toBe(
        secondsBetween(run.deadline.instant, early.deadline.instant),
      );
    }
    for (const saved of run.savedSetups) {
      const row = jobOrders.find((each) => each.productionOrderOperation === saved.jobOrder);
      expect(row?.plannedSetupS, saved.jobOrder).toBe(saved.setupS);
      const moved = run.moved[saved.jobOrder];
      expect(moved?.setupS).toBe(0);
      expect(moved?.equipment).toBe(saved.equipment);
      expect(moved?.start.instant).toBe(values.placements[saved.after]?.end.instant);
    }
    for (const [displayNumber, moved] of Object.entries(run.moved)) {
      const row = jobOrders.find((each) => each.productionOrderOperation === displayNumber);
      expect(row, displayNumber).toBeDefined();
      const laid = addWork(
        horizon,
        Date.parse(moved.start.instant),
        moved.setupS + (row?.plannedRunS ?? 0),
      );
      expect(laid, displayNumber).toEqual({
        startMs: Date.parse(moved.start.instant),
        endMs: Date.parse(moved.end.instant),
        segments: moved.segments.map(({ from, to }) => ({
          fromMs: Date.parse(from),
          toMs: Date.parse(to),
        })),
      });
      const setup = addWork(horizon, Date.parse(moved.start.instant), moved.setupS);
      expect(setup?.endMs, displayNumber).toBe(Date.parse(moved.runStart.instant));
    }
    // The split puts every moved row back to its committed placement, with its setup: each moved
    // row has an object-valued split placement, never a note instead of one.
    for (const displayNumber of Object.keys(run.moved)) {
      const back = run.split[displayNumber];
      expect(typeof back, `split of ${displayNumber}`).toBe('object');
      if (typeof back !== 'object') continue;
      const row = jobOrders.find((each) => each.productionOrderOperation === displayNumber);
      expect(row, displayNumber).toBeDefined();
      expect(back).toEqual({
        equipment: row?.equipment,
        start: values.placements[displayNumber]?.start,
        runStart: expect.objectContaining({ instant: row?.runStartAt }),
        end: values.placements[displayNumber]?.end,
        setupS: row?.plannedSetupS,
      });
    }
    const ends = Object.values(run.moved).map((moved) => Date.parse(moved.end.instant));
    expect(Date.parse(run.runEnd.instant)).toBe(Math.max(...ends));
    expect(run.late).toBe(Date.parse(run.runEnd.instant) > Date.parse(run.deadline.instant));
    expect(run.lateByElapsedS).toBe(secondsBetween(run.deadline.instant, run.runEnd.instant));
    for (const conflict of run.conflicts) {
      if (conflict.kind !== 'OVERLAP') continue;
      const [earlier, later] = conflict.rows;
      const a = values.placements[earlier ?? ''] ?? run.moved[earlier ?? ''];
      const b = run.moved[later ?? ''] ?? values.placements[later ?? ''];
      expect(a, earlier).toBeDefined();
      expect(b, later).toBeDefined();
      expect(Date.parse(a?.start.instant ?? '')).toBeLessThan(Date.parse(b?.end.instant ?? ''));
      expect(Date.parse(b?.start.instant ?? '')).toBeLessThan(Date.parse(a?.end.instant ?? ''));
    }
  });

  it('sums each workload bucket from its items and its setup and run parts', () => {
    for (const bucket of values.GT5_workload_week45) {
      const label = `${bucket.equipment} ${bucket.productionDay}`;
      expect(bucket.setupS + bucket.runS, label).toBe(bucket.loadedS);
      const fromItems = bucket.items.reduce((sum, item) => sum + item.seconds, 0);
      expect(fromItems, label).toBe(bucket.loadedS);
      expect(bucket.utilizationPermille, label).toBe(
        Math.round((bucket.loadedS * 1000) / bucket.availableS),
      );
      expect(bucket.overloadS, label).toBe(Math.max(0, bucket.loadedS - bucket.availableS));
    }
  });
});
