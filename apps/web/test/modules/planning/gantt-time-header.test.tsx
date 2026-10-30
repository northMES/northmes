// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

// The time scale fits each label to its cell by the tier's type size (#892), so the header must
// draw the labels at that size: the bottom tier's tick size must survive the class merge next to
// its muted text color.
describe('the time header of the order Gantt (#892)', () => {
  it('draws a bottom tier label at the tick size and a top tier label at the extra small size', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getByRole('columnheader', { name: 'Time' });

    const bottom = header.querySelector('[data-tier="bottom"]');
    const top = header.querySelector('[data-tier="top"]');

    expect(bottom?.classList).toContain('text-tick');
    expect(bottom?.classList).toContain('text-muted-foreground');
    expect(top?.classList).toContain('text-xs');
  });
});
