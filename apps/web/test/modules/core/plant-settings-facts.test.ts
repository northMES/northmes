// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import type {
  PlantCalendar,
  PlantCalendarDeviation,
} from '../../../src/modules/core/plant-settings-data.ts';
import {
  calendarDay,
  hoursText,
  patternText,
  shiftText,
  weeklyWorkingSeconds,
} from '../../../src/modules/core/plant-settings-facts.ts';
import { machineListSearch } from '../../../src/modules/core/plant-settings-search.ts';

/** A calendar of the fixture's shape with these deviations: Monday to Friday 06:00 to 15:00. */
function calendarWith(
  deviations: readonly PlantCalendarDeviation[],
  weekdays: readonly number[] = [1, 2, 3, 4, 5],
): PlantCalendar {
  return {
    name: 'A1',
    plantDefault: true,
    effectiveFrom: '2026-01-05',
    cycleWeeks: 1,
    shifts: [
      {
        name: 'Day',
        weekdays,
        start: '06:00',
        end: '15:00',
        breaks: [{ start: '08:30', end: '08:45' }],
        workingSeconds: 31_500,
      },
    ],
    machines: ['CNC1', 'CNC2', 'MILL1'],
    deviations,
  };
}

/** Three shifts of 7 h 15 min each: Early and Late Monday to Friday, Night Monday to Thursday. */
const threeShifts: PlantCalendar = {
  name: 'B3',
  plantDefault: false,
  effectiveFrom: '2026-01-05',
  cycleWeeks: 1,
  shifts: [
    {
      name: 'Early',
      weekdays: [1, 2, 3, 4, 5],
      start: '06:00',
      end: '14:00',
      breaks: [
        { start: '09:00', end: '09:15' },
        { start: '11:30', end: '12:00' },
      ],
      workingSeconds: 26_100,
    },
    {
      name: 'Late',
      weekdays: [1, 2, 3, 4, 5],
      start: '14:00',
      end: '22:00',
      breaks: [{ start: '17:00', end: '17:15' }],
      workingSeconds: 26_100,
    },
    {
      name: 'Night',
      weekdays: [1, 2, 3, 4],
      start: '22:00',
      end: '06:00',
      breaks: [],
      workingSeconds: 26_100,
    },
  ],
  machines: ['LATHE1', 'LATHE2'],
  deviations: [],
};

const holiday: PlantCalendarDeviation = {
  id: 'holiday',
  kind: 'nonWorking',
  startsLocal: '2026-11-09T00:00',
  endsLocal: '2026-11-10T00:00',
  reason: 'Plant holiday',
};

const millOvertimeOnTheHoliday: PlantCalendarDeviation = {
  id: 'mill-overtime',
  kind: 'overtime',
  startsLocal: '2026-11-09T06:00',
  endsLocal: '2026-11-09T10:00',
  reason: 'Finish order 1006',
  equipment: ['MILL1'],
};

const cncClosed: PlantCalendarDeviation = {
  id: 'cnc-closed',
  kind: 'nonWorking',
  startsLocal: '2026-11-04T00:00',
  endsLocal: '2026-11-05T00:00',
  reason: 'Spindle service',
  equipment: ['CNC1'],
};

const cncOvertime: PlantCalendarDeviation = {
  id: 'cnc-overtime',
  kind: 'overtime',
  startsLocal: '2026-11-04T15:00',
  endsLocal: '2026-11-04T18:00',
  equipment: ['CNC1'],
};

describe('shiftText (design #688, the calendars list and the machine page)', () => {
  it('writes consecutive working days as a span', () => {
    expect(shiftText(calendarWith([]))).toBe('Mon to Fri 06:00 to 15:00');
  });

  it('lists working days that are not consecutive, so no day reads as working that is not', () => {
    expect(shiftText(calendarWith([], [1, 3, 5]))).toBe('Mon, Wed, Fri 06:00 to 15:00');
  });
});

describe('a calendar with several shifts (#770)', () => {
  it('names each shift with its days and times', () => {
    expect(shiftText(threeShifts)).toBe(
      'Mon to Fri Early 06:00 to 14:00, Mon to Fri Late 14:00 to 22:00, Mon to Thu Night 22:00 to 06:00',
    );
  });

  it('adds up each shift over the days it starts on', () => {
    expect(hoursText(weeklyWorkingSeconds(threeShifts))).toBe('101 h 30 min');
  });

  it('writes each shift with its breaks for the machine page, and one shift without its name', () => {
    expect(patternText(threeShifts)).toBe(
      'Mon to Fri Early 06:00 to 14:00, breaks 09:00 to 09:15 and 11:30 to 12:00; Mon to Fri Late 14:00 to 22:00, break 17:00 to 17:15; Mon to Thu Night 22:00 to 06:00, no breaks',
    );
    expect(patternText(calendarWith([]))).toBe('Mon to Fri 06:00 to 15:00, break 08:30 to 08:45');
  });
});

describe('calendarDay, the precedence of ADR 0025 rule 7 (by scope, then by kind)', () => {
  it("keeps a machine's overtime on a plant-wide holiday, and closes the day for the other machines", () => {
    const calendar = calendarWith([holiday, millOvertimeOnTheHoliday]);

    const mill = calendarDay(calendar, '2026-11-09', 1, 'MILL1');
    expect(mill.working).toBe(false);
    expect(mill.closed).toBe(holiday);
    expect(mill.overtime).toEqual([millOvertimeOnTheHoliday]);

    const cnc = calendarDay(calendar, '2026-11-09', 1, 'CNC1');
    expect(cnc.working).toBe(false);
    expect(cnc.closed).toBe(holiday);
    expect(cnc.overtime).toEqual([]);
  });

  it("shows a machine's closed day to that machine only; All machines keeps the shift and names the machine", () => {
    const calendar = calendarWith([cncClosed]);

    const all = calendarDay(calendar, '2026-11-04', 3, undefined);
    expect(all.working).toBe(true);
    expect(all.closed).toBeUndefined();
    expect(all.machineClosures).toEqual([cncClosed]);

    const cnc1 = calendarDay(calendar, '2026-11-04', 3, 'CNC1');
    expect(cnc1.working).toBe(false);
    expect(cnc1.closed).toBe(cncClosed);

    const cnc2 = calendarDay(calendar, '2026-11-04', 3, 'CNC2');
    expect(cnc2.working).toBe(true);
    expect(cnc2.closed).toBeUndefined();
  });

  it("lets a machine's non-working deviation cancel its own overtime on that day", () => {
    const calendar = calendarWith([cncClosed, cncOvertime]);

    expect(calendarDay(calendar, '2026-11-04', 3, 'CNC1').overtime).toEqual([]);
    // All machines shows the machine's overtime as entered, beside its closure.
    expect(calendarDay(calendar, '2026-11-04', 3, undefined).overtime).toEqual([cncOvertime]);
  });
});

describe('machineListSearch (ADR 0062)', () => {
  it('keeps a filter value the router parsed as a number, as an all-digit group code is', () => {
    expect(machineListSearch({ group: 100 })).toEqual({ group: ['100'] });
    expect(machineListSearch({ calendar: 7, group: '100,200' })).toEqual({
      group: ['100', '200'],
      calendar: ['7'],
    });
  });
});
