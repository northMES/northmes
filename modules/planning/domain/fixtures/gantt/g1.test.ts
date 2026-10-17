// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import expected from './g1.expected.json' with { type: 'json' };
import g1 from './g1.json' with { type: 'json' };

/**
 * The fixture G1 of docs/plan/18-gantt-timeline.md: a synthetic plant week that every Gantt
 * function is tested against. Both files come from one calculator script, so this test guards
 * their shape and their internal consistency, not the calendar arithmetic. The regeneration
 * guard through addWork comes with the domain function S01 (plan 18, Domain unit tests).
 */

const instant = z.string().datetime();
const plantLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
const timePoint = z.object({ instant, plantLocal });
const clock = z.string().regex(/^\d{2}:\d{2}$/);

const rates = z.object({
  cycleSeconds: z.number().positive(),
  piecesPerCycle: z.number().int().positive(),
  cyclesPerPiece: z.number().int().positive(),
  planningFactor: z.number().positive(),
  retoolSeconds: z.number().int().nonnegative(),
  fixedSeconds: z.number().int().nonnegative(),
});

const jobOrder = z.object({
  id: z.string(),
  productionOrderOperation: z.string(),
  equipment: z.string(),
  quantity: z.number().int().positive(),
  status: z.enum(['planned', 'started', 'finished']),
  setupStartAt: instant,
  runStartAt: instant,
  endAt: instant,
  plannedSetupS: z.number().int().nonnegative(),
  plannedRunS: z.number().int().positive(),
  rates,
});

const operation = z.object({
  displayNumber: z.string(),
  sequence: z.number().int().positive(),
  name: z.string(),
  quantity: z.number().int().positive(),
  rates,
  leadTimeS: z.number().int().nonnegative(),
  sendAheadQuantity: z.number().int().nonnegative(),
  isLocked: z.boolean(),
  allowedEquipment: z.array(z.string()).nonempty(),
});

const productionOrder = z.object({
  number: z.string(),
  article: z.string(),
  quantity: z.number().int().positive(),
  deadlineDate: z.string().date(),
  deadlineTime: clock.nullable(),
  deadlineInstant: timePoint,
  priority: z.number().int().nullable(),
  color: z.string(),
  status: z.enum(['planned', 'released']),
  operations: z.array(operation).nonempty(),
  jobOrders: z.array(jobOrder).nonempty(),
});

const snapshot = z.object({
  id: z.literal('G1'),
  description: z.string(),
  plant: z.object({ slug: z.string(), timeZone: z.string(), productionDayStart: clock }),
  settings: z.object({
    deadlineRule: z.enum(['endOfShift', 'startOfDay']),
    shiftEndForDeadline: clock,
    frozenHours: z.number().nonnegative(),
    leadTimeBasis: z.enum(['elapsed', 'working']),
    retoolOverlapsLeadTime: z.boolean(),
    planningFactorSource: z.string(),
  }),
  now: timePoint,
  fence: timePoint,
  calendar: z.object({
    name: z.string(),
    weekdays: z.array(z.number().int().min(1).max(7)),
    shift: z.object({ start: clock, end: clock }),
    breaks: z.array(z.object({ start: clock, end: clock })),
    workingSecondsPerDay: z.number().int().positive(),
    deviations: z.array(z.unknown()),
  }),
  equipmentGroups: z.array(z.object({ code: z.string(), name: z.string(), color: z.string() })),
  equipment: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      group: z.string(),
      isPlannable: z.boolean(),
      calendar: z.string(),
    }),
  ),
  productionOrders: z.array(productionOrder).nonempty(),
});

const segment = z.object({ from: instant, to: instant });
const placement = z.object({
  start: timePoint,
  end: timePoint,
  segments: z.array(segment).nonempty(),
});

const workloadBucket = z.object({
  productionDay: z.string().date(),
  equipment: z.string(),
  availableS: z.number().int().nonnegative(),
  loadedS: z.number().int().nonnegative(),
  setupS: z.number().int().nonnegative(),
  runS: z.number().int().nonnegative(),
  utilizationPermille: z.number().int().nonnegative(),
  overloadS: z.number().int().nonnegative(),
  items: z.array(z.object({ jobOrder: z.string(), seconds: z.number().int().positive() })),
});

const expectedValues = z
  .object({
    dataset: z.literal('G1'),
    durations: z.record(
      z.string(),
      z.object({
        plannedSeconds: z.number().int().positive(),
        setupSeconds: z.number().int().nonnegative(),
        runSeconds: z.number().int().positive(),
      }),
    ),
    placements: z.record(z.string(), placement),
    GT5_workload_week45: z.array(workloadBucket).nonempty(),
  })
  .passthrough();

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
] as const;

const secondsBetween = (from: string, to: string): number =>
  Temporal.Instant.from(from).until(Temporal.Instant.from(to)).total('seconds');

const toPlantLocal = (at: string, timeZone: string): string =>
  Temporal.Instant.from(at).toZonedDateTimeISO(timeZone).toPlainDateTime().toString();

describe('fixture G1 (plan 18)', () => {
  const data = snapshot.parse(g1);
  const values = expectedValues.parse(expected);
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
      const pair = timePoint.safeParse(value);
      if (pair.success) {
        points.push(pair.data);
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
