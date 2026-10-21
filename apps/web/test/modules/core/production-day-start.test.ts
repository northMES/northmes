// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  nextUnevenProductionDay,
  productionDayStartClash,
} from '../../../src/modules/core/production-day-start.ts';

describe('the next production day that the clocks make shorter or longer than 24 hours (ADR 0025, CAL9)', () => {
  it('CAL9 with a 06:00 start in Europe/Stockholm, the day of Sat 27 Mar 2027 lasts 23 h', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '06:00', Date.parse('2026-11-02T08:40:00Z')),
    ).toEqual({ date: '2027-03-27', seconds: 82_800 });
  });

  it('CAL9 with a 06:00 start in Europe/Stockholm, the day of Sat 24 Oct 2026 lasts 25 h', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '06:00', Date.parse('2026-10-21T08:00:00Z')),
    ).toEqual({ date: '2026-10-24', seconds: 90_000 });
  });

  it('the production day that runs now counts, though its clock change has passed', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '06:00', Date.parse('2026-10-25T03:00:00Z')),
    ).toEqual({ date: '2026-10-24', seconds: 90_000 });
  });

  it('a day start before the change puts the uneven day on the date of the change', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '00:00', Date.parse('2026-11-02T08:40:00Z')),
    ).toEqual({ date: '2027-03-28', seconds: 82_800 });
  });

  it('a day start at the wall time just after the spring change puts the short day before it', () => {
    expect(
      nextUnevenProductionDay('Europe/Stockholm', '03:00', Date.parse('2026-11-02T08:40:00Z')),
    ).toEqual({ date: '2027-03-27', seconds: 82_800 });
  });

  it('a half-hour change, as on Lord Howe Island, makes a day of 24 h 30 min', () => {
    expect(
      nextUnevenProductionDay('Australia/Lord_Howe', '06:00', Date.parse('2026-11-02T08:40:00Z')),
    ).toEqual({ date: '2027-04-03', seconds: 88_200 });
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
