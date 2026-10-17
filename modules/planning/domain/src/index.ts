// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The planning domain package (ADR 0057): pure functions over plain data, with no Nest, React or
// database. The scheduling functions of plan 07 and plan 18 land here story by story, on the
// calendar kernel of ADR 0025; the package also holds the fixture G1 that the order Gantt in
// apps/web reads as its mock data.
export {
  availabilityOf,
  type CalendarDeviation,
  type ClockSpan,
  resolveLocalDateTime,
  resolveWallClock,
  type Shift,
  type WeeklyCalendarInput,
  type WorkingCalendar,
  weeklyCalendar,
} from './calendar/calendar.ts';
export {
  addWork,
  clipWindows,
  nextWorkingInstant,
  normalizeWindows,
  type Placement,
  subtractWindows,
  subtractWork,
  unionWindows,
  type Window,
  type Windows,
  workBetween,
} from './calendar/windows.ts';
export {
  bindingText,
  type ChainResult,
  type ChainRow,
  chainRowLimit,
  criticalChain,
} from './critical-chain.ts';
export {
  cyclesFor,
  oneCycleSeconds,
  plannedSeconds,
  type Rates,
  runSecondsFor,
  setupSeconds,
} from './duration.ts';
export {
  type GanttExpected,
  type GanttFixture,
  g1,
  g1Expected,
  ganttExpected,
  ganttFixture,
} from './fixtures/gantt.ts';
export { g1HorizonEndMs, g1OrderId, g1PlanContext } from './fixtures/gantt-context.ts';
export {
  type BindingConstraint,
  type BindingConstraintKind,
  type FloatResult,
  floatOf,
  lastRowOf,
  type RowFloat,
} from './float.ts';
export {
  availabilityOn,
  compareCodeUnits,
  compareRows,
  type JobOrderSpan,
  type JobOrderStatus,
  operationsInSequence,
  type PlanContext,
  type PlanJobOrder,
  type PlanOperation,
  type PlanOrder,
  type PlanSettings,
  type Reservation,
  reservationsOn,
  rowsOfOperation,
} from './plan-context.ts';
export { lastPieceMinEnd, type Release, releaseOf } from './release.ts';
