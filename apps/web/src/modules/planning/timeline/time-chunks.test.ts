// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { chunksCovering, chunkUnitOf, isFarChunk, wantedChunks } from './time-chunks.ts';

const zone = 'Europe/Stockholm';
const at = (iso: string) => Date.parse(iso);

describe('ADR0089 time chunks (Loading by time chunk)', () => {
  it('loads an ISO week up to week, a month at 4weeks and quarter, and a quarter at year', () => {
    expect(chunkUnitOf('quarter-hours')).toBe('isoWeek');
    expect(chunkUnitOf('hours')).toBe('isoWeek');
    expect(chunkUnitOf('day')).toBe('isoWeek');
    expect(chunkUnitOf('week')).toBe('isoWeek');
    expect(chunkUnitOf('4weeks')).toBe('month');
    expect(chunkUnitOf('quarter')).toBe('month');
    expect(chunkUnitOf('year')).toBe('quarter');
  });

  it('aligns ISO weeks to Monday midnight in plant time, across the clock change of 25 October', () => {
    // Wed 21 Oct to Tue 3 Nov 2026 touches W43, W44 and W45; W43 ends on Sun 25 Oct, the autumn
    // clock change, so it lasts 7 days and 1 hour.
    const chunks = chunksCovering(
      { fromMs: at('2026-10-21T10:00:00Z'), toMs: at('2026-11-03T10:00:00Z') },
      'week',
      zone,
    );

    expect(chunks).toEqual([
      { key: '2026-W43', fromMs: at('2026-10-18T22:00:00Z'), toMs: at('2026-10-25T23:00:00Z') },
      { key: '2026-W44', fromMs: at('2026-10-25T23:00:00Z'), toMs: at('2026-11-01T23:00:00Z') },
      { key: '2026-W45', fromMs: at('2026-11-01T23:00:00Z'), toMs: at('2026-11-08T23:00:00Z') },
    ]);
  });

  it('aligns months to the first and quarters to January, April, July and October', () => {
    const range = { fromMs: at('2026-11-20T10:00:00Z'), toMs: at('2027-01-05T10:00:00Z') };

    expect(chunksCovering(range, 'quarter', zone).map((chunk) => chunk.key)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
    expect(chunksCovering(range, 'year', zone)).toEqual([
      { key: '2026-Q4', fromMs: at('2026-09-30T22:00:00Z'), toMs: at('2026-12-31T23:00:00Z') },
      { key: '2027-Q1', fromMs: at('2026-12-31T23:00:00Z'), toMs: at('2027-03-31T22:00:00Z') },
    ]);
  });

  it('treats a range as half-open, so a range that ends at a chunk start does not touch that chunk', () => {
    const chunks = chunksCovering(
      { fromMs: at('2026-11-02T10:00:00Z'), toMs: at('2026-11-08T23:00:00Z') },
      'week',
      zone,
    );

    expect(chunks.map((chunk) => chunk.key)).toEqual(['2026-W45']);
  });

  it('wants the chunks in view first, then the rest of the buffer, then one chunk ahead on each side', () => {
    // At hours the view is a day of W45 and the buffer reaches into W44 and W46.
    const wanted = wantedChunks({
      view: { fromMs: at('2026-11-04T05:00:00Z'), toMs: at('2026-11-04T15:00:00Z') },
      buffer: { fromMs: at('2026-11-01T12:00:00Z'), toMs: at('2026-11-09T12:00:00Z') },
      zoom: 'hours',
      timeZone: zone,
    });

    expect(wanted.map((chunk) => chunk.key)).toEqual([
      '2026-W45',
      '2026-W44',
      '2026-W46',
      '2026-W43',
      '2026-W47',
    ]);
  });

  it('keys an ISO week by its week-year, so the week of Mon 28 Dec 2026 is 2026-W53 and that of Mon 29 Dec 2025 is 2026-W01', () => {
    const keys = (fromIso: string, toIso: string) =>
      chunksCovering({ fromMs: at(fromIso), toMs: at(toIso) }, 'day', zone).map(
        (chunk) => chunk.key,
      );

    expect(keys('2025-12-30T10:00:00Z', '2025-12-30T11:00:00Z')).toEqual(['2026-W01']);
    expect(keys('2026-12-30T10:00:00Z', '2027-01-05T10:00:00Z')).toEqual(['2026-W53', '2027-W01']);
  });

  it('covers no chunk for an empty range or one that is not a span of time', () => {
    const mid = at('2026-11-04T10:00:00Z');

    expect(chunksCovering({ fromMs: mid, toMs: mid }, 'week', zone)).toEqual([]);
    expect(chunksCovering({ fromMs: mid, toMs: Number.NaN }, 'week', zone)).toEqual([]);
    expect(chunksCovering({ fromMs: mid, toMs: Number.POSITIVE_INFINITY }, 'week', zone)).toEqual(
      [],
    );
    expect(chunksCovering({ fromMs: Number.NaN, toMs: mid }, 'week', zone)).toEqual([]);
    expect(
      wantedChunks({
        view: { fromMs: mid, toMs: mid },
        buffer: { fromMs: mid, toMs: mid },
        zoom: 'week',
        timeZone: zone,
      }),
    ).toEqual([]);
  });

  it('drops a chunk only when it lies more than two buffer widths from the buffer', () => {
    const buffer = { fromMs: at('2026-11-02T00:00:00Z'), toMs: at('2026-11-05T00:00:00Z') };
    const span = buffer.toMs - buffer.fromMs;

    expect(
      isFarChunk({ fromMs: buffer.toMs + 2 * span, toMs: buffer.toMs + 3 * span }, buffer),
    ).toBe(false);
    expect(
      isFarChunk({ fromMs: buffer.toMs + 2 * span + 1, toMs: buffer.toMs + 3 * span }, buffer),
    ).toBe(true);
    expect(isFarChunk({ fromMs: 0, toMs: buffer.fromMs - 2 * span }, buffer)).toBe(false);
    expect(isFarChunk({ fromMs: 0, toMs: buffer.fromMs - 2 * span - 1 }, buffer)).toBe(true);
  });
});
