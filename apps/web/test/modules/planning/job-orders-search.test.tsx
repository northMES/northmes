// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  jobOrdersSearch,
  sortedBy,
  sortOf,
} from '../../../src/modules/planning/job-orders-search.ts';

describe('jobOrdersSearch (ADR 0091, URL keys)', () => {
  it('ADR0091 reads the search, Late only, the filters as comma lists, the grouping and the sort', () => {
    expect(
      jobOrdersSearch({
        q: ' 1003 ',
        late: '1',
        equipment: 'CNC1,none',
        status: 'planned,finished',
        article: 'Hub 12',
        group: 'startDay',
        sort: '-deadline',
      }),
    ).toEqual({
      q: '1003',
      late: 1,
      equipment: ['CNC1', 'none'],
      status: ['planned', 'finished'],
      article: ['Hub 12'],
      group: 'startDay',
      sort: '-deadline',
    });
  });

  it('ADR0091 drops zoom and from, which mean nothing without a range', () => {
    expect(jobOrdersSearch({ zoom: 'week', from: '2026-11-02' })).toEqual({});
    expect(jobOrdersSearch({ zoom: 37.5, from: '2026-11-03T13:20', q: '1001' })).toEqual({
      q: '1001',
    });
  });

  it('ADR0091 lets each key fall back on its own (ADR 0062)', () => {
    expect(
      jobOrdersSearch({
        q: 'x'.repeat(101),
        late: 'yes',
        status: 'planned,lost',
        group: 'week',
        sort: 'quantity',
        equipment: 'CNC2',
      }),
    ).toEqual({ status: ['planned'], equipment: ['CNC2'] });
  });

  it('ADR0091 reads a filter value that the router parsed as a number, such as a numeric article (ADR 0062)', () => {
    expect(jobOrdersSearch({ article: 100234, equipment: 1001 })).toEqual({
      article: ['100234'],
      equipment: ['1001'],
    });
  });

  it('ADR0091 reads the grouping by equipment and by start day, and no other', () => {
    expect(jobOrdersSearch({ group: 'equipment' })).toEqual({ group: 'equipment' });
    expect(jobOrdersSearch({ group: 'machine' })).toEqual({});
  });

  it('ADR0091 sorts by start by default and leaves that sort out of the URL', () => {
    expect(sortOf({})).toEqual({ id: 'start', desc: false });
    expect(sortOf({ sort: '-machine' })).toEqual({ id: 'machine', desc: true });
    expect(sortedBy({ q: '1001', sort: 'deadline' }, { id: 'start', desc: false })).toEqual({
      q: '1001',
    });
    expect(sortedBy({}, { id: 'machine', desc: false })).toEqual({ sort: 'machine' });
  });
});
