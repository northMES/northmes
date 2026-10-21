// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  nextUnevenProductionDay,
  productionDayStartClash,
} from '../../../src/modules/core/production-day-start.ts';

describe('the next production day that the clocks make 23 or 25 hours long (ADR 0025, CAL9)', () => {
  it('CAL9 with a 06:00 start in Europe/Stockholm, the day of Sat 27 Mar 2027 lasts 23 h', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '06:00', Date.parse('2026-11-02T08:40:00Z')),
    ).toEqual({ date: '2027-03-27', hours: 23 });
  });

  it('CAL9 with a 06:00 start in Europe/Stockholm, the day of Sat 24 Oct 2026 lasts 25 h', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '06:00', Date.parse('2026-10-21T08:00:00Z')),
    ).toEqual({ date: '2026-10-24', hours: 25 });
  });

  it('a day start before the change puts the uneven day on the date of the change', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '00:00', Date.parse('2026-11-02T08:40:00Z')),
    ).toEqual({ date: '2027-03-28', hours: 23 });
  });

  it('a zone without clock changes has no uneven day', () => {
    expect(nextUnevenProductionDay('UTC', '06:00', Date.parse('2026-11-02T08:40:00Z'))).toBe(
      undefined,
    );
  });
});

describe("a production day start checked against the zone's clock changes (ADR 0025)", () => {
  it('CAL8 Europe/Stockholm refuses 02:30, which repeats in autumn and is skipped in spring', () => {
    expect(productionDayStartClash('Europe/Stockholm', '02:30', '2026-10-21')).toEqual({
      repeated: '2026-10-25',
      skipped: '2027-03-28',
    });
  });

  it('CAL8 Europe/Stockholm accepts 06:00', () => {
    expect(productionDayStartClash('Europe/Stockholm', '06:00', '2026-10-21')).toBeUndefined();
  });

  it('names only the change that hits the time: 02:30 in New York is skipped in March and never repeats', () => {
    expect(productionDayStartClash('America/New_York', '02:30', '2026-10-21')).toEqual({
      skipped: '2027-03-14',
    });
  });

  it('a zone without clock changes accepts every time', () => {
    expect(productionDayStartClash('UTC', '02:30', '2026-10-21')).toBeUndefined();
  });
});
