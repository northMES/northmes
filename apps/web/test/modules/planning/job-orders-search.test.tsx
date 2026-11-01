// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  jobOrdersSearch,
  sortedBy,
  sortOf,
} from '../../../src/modules/planning/job-orders-search.ts';

describe('jobOrdersSearch (ADR 0091, URL keys)', () => {
  it('reads the search, Late only, the filters as comma lists, the grouping and the sort', () => {
    expect(
      jobOrdersSearch({
        q: ' 1003 ',
        late: '1',
        machine: 'CNC1,none',
        status: 'planned,finished',
        article: 'Hub 12',
        group: 'startDay',
        sort: '-deadline',
      }),
    ).toEqual({
      q: '1003',
      late: 1,
      machine: ['CNC1', 'none'],
      status: ['planned', 'finished'],
      article: ['Hub 12'],
      group: 'startDay',
      sort: '-deadline',
    });
  });

  it('drops zoom and from, which mean nothing without a range', () => {
    expect(jobOrdersSearch({ zoom: 'week', from: '2026-11-02' })).toEqual({});
    expect(jobOrdersSearch({ zoom: 37.5, from: '2026-11-03T13:20', q: '1001' })).toEqual({
      q: '1001',
    });
  });

  it('lets each key fall back on its own (ADR 0062)', () => {
    expect(
      jobOrdersSearch({
        q: 'x'.repeat(101),
        late: 'yes',
        status: 'planned,lost',
        group: 'week',
        sort: 'quantity',
        machine: 'CNC2',
      }),
    ).toEqual({ status: ['planned'], machine: ['CNC2'] });
  });

  it('sorts by start by default and leaves that sort out of the URL', () => {
    expect(sortOf({})).toEqual({ id: 'start', desc: false });
    expect(sortOf({ sort: '-machine' })).toEqual({ id: 'machine', desc: true });
    expect(sortedBy({ q: '1001', sort: 'deadline' }, { id: 'start', desc: false })).toEqual({
      q: '1001',
    });
    expect(sortedBy({}, { id: 'machine', desc: false })).toEqual({ sort: 'machine' });
  });
});
