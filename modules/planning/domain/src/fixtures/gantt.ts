// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import expectedJson from '../../fixtures/gantt/g1.expected.json' with { type: 'json' };
import g1Json from '../../fixtures/gantt/g1.json' with { type: 'json' };

/**
 * The fixture G1 of docs/plan/18-gantt-timeline.md, as the shapes below read it: a synthetic plant
 * week that every Gantt function and the mock-data order Gantt in apps/web are tested against.
 * The two files come from one calculator script; the shapes guard what the readers rely on.
 */

/** An ISO instant with its plant-local wall clock beside it. */
export const timePoint = z.object({
  instant: z.iso.datetime(),
  plantLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
});

/** A clock of the plant, "06:00". */
export const clock = z.string().regex(/^\d{2}:\d{2}$/);

/** A deviation of the calendar as src/calendar/calendar.ts reads it; G1 has none. */
export const calendarDeviation = z.object({
  kind: z.enum(['overtime', 'nonWorking']),
  startsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  reason: z.string().optional(),
  equipment: z.array(z.string()).nonempty().optional(),
});

export const rates = z.object({
  cycleSeconds: z.number().positive(),
  piecesPerCycle: z.number().int().positive(),
  cyclesPerPiece: z.number().int().positive(),
  planningFactor: z.number().positive(),
  retoolSeconds: z.number().int().nonnegative(),
  fixedSeconds: z.number().int().nonnegative(),
});

export const jobOrder = z.object({
  id: z.string(),
  productionOrderOperation: z.string(),
  equipment: z.string(),
  quantity: z.number().int().positive(),
  status: z.enum(['planned', 'started', 'finished']),
  setupStartAt: z.iso.datetime(),
  runStartAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  plannedSetupS: z.number().int().nonnegative(),
  plannedRunS: z.number().int().positive(),
  rates,
});

export const operation = z.object({
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

export const productionOrder = z.object({
  number: z.string(),
  article: z.string(),
  quantity: z.number().int().positive(),
  deadlineDate: z.iso.date(),
  deadlineTime: clock.nullable(),
  deadlineInstant: timePoint,
  priority: z.number().int().nullable(),
  color: z.string(),
  status: z.enum(['planned', 'released']),
  /** Who owns the order: the ERP, or NorthMES for an order created in the app (ADR 0083's review step names it). */
  owner: z.enum(['erp', 'northmes']).default('erp'),
  operations: z.array(operation).nonempty(),
  jobOrders: z.array(jobOrder).nonempty(),
});

/** The snapshot shape of g1.json: the plant, its settings, the calendar, the machines and the orders. */
export const ganttFixture = z.object({
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
    deviations: z.array(calendarDeviation),
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

export const segment = z.object({ from: z.iso.datetime(), to: z.iso.datetime() });

export const placement = z.object({
  start: timePoint,
  end: timePoint,
  segments: z.array(segment).nonempty(),
});

export const workloadBucket = z.object({
  productionDay: z.iso.date(),
  equipment: z.string(),
  availableS: z.number().int().nonnegative(),
  loadedS: z.number().int().nonnegative(),
  setupS: z.number().int().nonnegative(),
  runS: z.number().int().nonnegative(),
  utilizationPermille: z.number().int().nonnegative(),
  overloadS: z.number().int().nonnegative(),
  items: z.array(z.object({ jobOrder: z.string(), seconds: z.number().int().positive() })),
});

/** What stops a row from starting earlier (plan 18, Float and the critical chain). */
export const bindingConstraint = z.object({
  kind: z.enum([
    'started',
    'hardLock',
    'frozenWindow',
    'earliestStart',
    'release',
    'machine',
    'calendar',
    'free',
  ]),
  boundBy: z.string().optional(),
  equipment: z.string().optional(),
  detail: z.string().optional(),
});

/** The float values of one row (GT1, GT2). */
export const rowFloat = z.object({
  earliestStart: timePoint,
  waitWorkingS: z.number().int().nonnegative(),
  latestStart: timePoint,
  latestEnd: timePoint,
  totalFloatWorkingS: z.number().int(),
  freeFloatWorkingS: z.number().int().nonnegative(),
  bindingConstraint,
  critical: z.boolean(),
});

/** One row of a critical chain as text, with the root marked. */
export const chainRow = z.object({
  row: z.string(),
  bindingConstraint: z.string(),
  critical: z.boolean().optional(),
  root: z.boolean().optional(),
  otherOrder: z.string().optional(),
  totalFloatWorkingS: z.number().int().optional(),
});

export const orderChain = z.object({
  late: z.boolean(),
  slackToDeadlineElapsedS: z.number().int().optional(),
  chain: z.array(chainRow).nonempty(),
  criticalRows: z.array(z.string()),
});

/** A row as a run or a split places it (GT10): its machine, span, setup and segments. */
export const runPlacement = z.object({
  equipment: z.string(),
  start: timePoint,
  runStart: timePoint,
  end: timePoint,
  setupS: z.number().int().nonnegative(),
  segments: z.array(segment).nonempty(),
  reason: z.string(),
});

/** The run of 1001 and 1005 (GT10, ADR 0083): the run record, the moves, the breaks and the split. */
export const runCase = z.looseObject({
  orders: z.array(z.string()).min(2),
  article: z.string(),
  runOrder: z.array(z.string()).min(2),
  deadline: timePoint,
  early: z.array(
    z.object({
      order: z.string(),
      deadline: timePoint,
      earlyByElapsedS: z.number().int().positive(),
    }),
  ),
  savedSetups: z.array(
    z.object({
      jobOrder: z.string(),
      after: z.string(),
      equipment: z.string(),
      setupS: z.number().int().positive(),
    }),
  ),
  moved: z.record(z.string(), runPlacement),
  conflicts: z.array(z.object({ kind: z.string(), rows: z.array(z.string()), detail: z.string() })),
  runStart: timePoint,
  runEnd: timePoint,
  late: z.boolean(),
  lateByElapsedS: z.number().int().nonnegative(),
  /** The split: every moved row back to the placement it had before the combine, by display number. */
  split: z.record(
    z.string(),
    z.union([
      z.object({
        equipment: z.string(),
        start: timePoint,
        runStart: timePoint,
        end: timePoint,
        setupS: z.number().int().nonnegative(),
      }),
      z.string(),
    ]),
  ),
});

/** The expected values of g1.expected.json that the Gantt readers take, the rest passed through. */
export const ganttExpected = z.looseObject({
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
  GT1_float_1001: z.looseObject({
    slackToDeadlineElapsedS: z.number().int(),
    plannedEnd: timePoint,
    late: z.literal(false),
  }),
  GT2_late_chain_1003: z.looseObject({
    late: z.literal(true),
    lateByElapsedS: z.number().int().positive(),
    lateByWorkingSOnMILL1: z.number().int().positive(),
    plannedEnd: timePoint,
  }),
  GT3_cascade_1003: z.looseObject({
    moved: z.record(z.string(), z.object({ start: timePoint, end: timePoint })),
    cascadeOff: z.looseObject({
      conflicts: z.array(
        z.object({ kind: z.string(), rows: z.array(z.string()), detail: z.string() }),
      ),
    }),
  }),
  GT4_send_ahead_last_piece_1004: z.looseObject({
    releaseOf300Pieces: timePoint,
    releaseWithLead1800: timePoint,
    lastPieceMinEnd: timePoint,
  }),
  GT1_GT2_floats: z.record(z.string(), rowFloat),
  GT1_chain_1001: orderChain,
  GT2_chain_1003: orderChain,
  GT5_workload_week45: z.array(workloadBucket).nonempty(),
  GT7_calendar_span_1006: z.looseObject({
    base: z.looseObject({ workingS: z.number().int(), elapsedS: z.number().int() }),
  }),
  GT10_run_1001_1005: runCase,
});

export type GanttFixture = z.infer<typeof ganttFixture>;
export type GanttExpected = z.infer<typeof ganttExpected>;

/** G1 as data: the plant week of plan 18. */
export const g1: GanttFixture = ganttFixture.parse(g1Json);

/** The expected values of G1, keyed GT1 to GT9 as plan 18 quotes them. */
export const g1Expected: GanttExpected = ganttExpected.parse(expectedJson);
