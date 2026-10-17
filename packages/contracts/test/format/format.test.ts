// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  formatDuration,
  formatPlantDate,
  formatPlantDateTime,
  formatPlantDay,
  formatPlantTime,
  formatSpan,
} from '@northmes/contracts/format';
import { describe, expect, it } from 'vitest';

const stockholm = 'Europe/Stockholm';

/** Tue 3 Nov 2026 11:30 in Stockholm, the setup start of G1's 1001.10. */
const tueMorning = Date.UTC(2026, 10, 3, 10, 30);

/** Thu 5 Nov 2026 10:45 in Stockholm, the end of G1's 1001.20. */
const thuMorning = Date.UTC(2026, 10, 5, 9, 45);

describe('plant time formatters (ADR 0061, plan 18)', () => {
  it('GT1 formats an instant as the plant weekday, day, month and clock under the pinned locale', () => {
    expect(formatPlantDateTime(tueMorning, stockholm)).toBe('Tue 3 Nov 11:30');
    expect(formatPlantDate(tueMorning, stockholm)).toBe('Tue 3 Nov');
    expect(formatPlantTime(tueMorning, stockholm)).toBe('11:30');
  });

  it('GT1 formats a span as from and to in plant time', () => {
    expect(formatSpan(tueMorning, thuMorning, stockholm)).toBe(
      'Tue 3 Nov 11:30 to Thu 5 Nov 10:45',
    );
  });

  it('GT9 adds the short zone name only when asked', () => {
    expect(formatPlantDateTime(tueMorning, stockholm, { zoneLabel: true })).toBe(
      'Tue 3 Nov 11:30 CET',
    );
    expect(formatPlantTime(tueMorning, stockholm, { zoneLabel: true })).toBe('11:30 CET');
  });

  it('GT5 formats a plant date without an instant', () => {
    expect(formatPlantDay('2026-11-05')).toBe('Thu 5 Nov');
  });

  it('formats a clock under h23, so a night time keeps its leading zero', () => {
    expect(formatPlantTime(Date.UTC(2026, 10, 9, 5, 0), stockholm)).toBe('06:00');
    expect(formatPlantDateTime(Date.UTC(2026, 10, 5, 23, 15), stockholm)).toBe('Fri 6 Nov 00:15');
  });
});

describe('formatDuration (plan 18)', () => {
  it('GT2 prints hours and minutes, and days from 24 hours', () => {
    expect(formatDuration(54_900)).toBe('15 h 15 min');
    expect(formatDuration(900)).toBe('15 min');
    expect(formatDuration(14_400)).toBe('4 h');
    expect(formatDuration(101_700)).toBe('1 day 4 h 15 min');
    expect(formatDuration(237_600)).toBe('2 days 18 h');
  });

  it('GT7 keeps whole hours when asked, as the elapsed time of a block', () => {
    expect(formatDuration(237_600, { form: 'hours' })).toBe('66 h');
    expect(formatDuration(10_800, { form: 'hours' })).toBe('3 h');
  });

  it('GT2 prints a negative duration with the word minus and zero as 0 min', () => {
    expect(formatDuration(-900)).toBe('minus 15 min');
    expect(formatDuration(0)).toBe('0 min');
  });

  it('GT3 spells the units out for a sentence when asked', () => {
    expect(formatDuration(2700, { style: 'long' })).toBe('45 minutes');
    expect(formatDuration(54_900, { style: 'long' })).toBe('15 hours 15 minutes');
    expect(formatDuration(90_000, { style: 'long' })).toBe('1 day 1 hour');
    expect(formatDuration(0, { style: 'long' })).toBe('0 minutes');
  });

  it('GT4 keeps the seconds of a duration that is not whole minutes', () => {
    expect(formatDuration(14_980)).toBe('4 h 9 min 40 s');
    expect(formatDuration(20)).toBe('20 s');
  });
});
