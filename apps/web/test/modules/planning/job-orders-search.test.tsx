// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { jobOrdersSearch } from '../../../src/modules/planning/job-orders-search.ts';

describe('jobOrdersSearch (ADR 0089, Zoom levels)', () => {
  it('keeps the four presets as the Range', () => {
    for (const zoom of ['hours', 'day', 'week', '4weeks']) {
      expect(jobOrdersSearch({ zoom })).toEqual({ zoom });
    }
  });

  it('opens a link at Quarter hours at Hours, and one at Quarter or Year at 4 weeks', () => {
    expect(jobOrdersSearch({ zoom: 'quarter-hours', from: '2026-11-04' })).toEqual({
      zoom: 'hours',
      from: '2026-11-04',
    });
    expect(jobOrdersSearch({ zoom: 'quarter' })).toEqual({ zoom: '4weeks' });
    expect(jobOrdersSearch({ zoom: 'year' })).toEqual({ zoom: '4weeks' });
  });

  it('opens a link whose from is the visible start of the board or the Gantt at its date (ADR 0089)', () => {
    expect(jobOrdersSearch({ from: '2026-11-03T13:20' })).toEqual({ from: '2026-11-03' });
  });

  it('drops an unknown zoom', () => {
    expect(jobOrdersSearch({ zoom: 'decade' })).toEqual({});
  });
});
