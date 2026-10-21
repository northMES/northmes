// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { productionDayStartClash } from '../../../src/modules/core/production-day-start.ts';

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
