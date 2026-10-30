// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TimeCellShading } from '../../../src/modules/planning/screens/gantt/gantt-time-area.tsx';
import {
  createTimeScale,
  naturalWidthPx,
  rangeOf,
} from '../../../src/modules/planning/timeline/time-scale.ts';

afterEach(cleanup);

const stockholm = 'Europe/Stockholm';

describe('the closed time of a row (ADR 0089, Header tiers)', () => {
  it('draws no closed window narrower than one pixel at the level', () => {
    const range = rangeOf('2026-11-01', 'quarter', stockholm, '06:00');
    const scale = createTimeScale({
      range,
      zoom: 'quarter',
      timeZone: stockholm,
      widthPx: naturalWidthPx(range, 'quarter'),
    });
    // A 30 min break is 0.3 px at Quarter; an 8 h night is 4.8 px.
    const lunch = { fromMs: Date.UTC(2026, 10, 4, 11), toMs: Date.UTC(2026, 10, 4, 11, 30) };
    const night = { fromMs: Date.UTC(2026, 10, 4, 21), toMs: Date.UTC(2026, 10, 5, 5) };

    const { container } = render(<TimeCellShading windows={[lunch, night]} scale={scale} />);

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-shading]')].map((each) =>
        Number(each.dataset.fromMs),
      ),
    ).toEqual([night.fromMs]);
  });
});
