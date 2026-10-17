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
  weeklyCalendar,
  type WorkingCalendar,
} from './calendar/calendar.ts';
export {
  addWork,
  clipWindows,
  normalizeWindows,
  type Placement,
  subtractWindows,
  unionWindows,
  type Window,
  type Windows,
} from './calendar/windows.ts';
export {
  type GanttExpected,
  type GanttFixture,
  g1,
  g1Expected,
  ganttExpected,
  ganttFixture,
} from './fixtures/gantt.ts';
