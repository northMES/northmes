// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { GanttBlock } from '../../../src/modules/planning/screens/gantt/gantt-block.tsx';
import {
  type GanttViewContext,
  GanttViewProvider,
} from '../../../src/modules/planning/screens/gantt/gantt-context.ts';
import {
  buildGanttRows,
  jobOrderRowsOf,
} from '../../../src/modules/planning/screens/gantt/gantt-rows.ts';
import { closedWindows } from '../../../src/modules/planning/timeline/availability-shading.ts';
import { createTimeScale, rangeOf } from '../../../src/modules/planning/timeline/time-scale.ts';

afterEach(cleanup);

/** Renders one job order's block inside a Gantt view of G1 at Week zoom, 840 px wide. */
function renderBlock(jobOrderId: string, onChain: boolean) {
  const snapshot = g1Snapshot();
  const timeZone = snapshot.plant.timeZone;
  const range = rangeOf('2026-11-02', 'week', timeZone, snapshot.plant.productionDayStart);
  const closed = closedWindows(snapshot.calendar, timeZone, range);
  const view: GanttViewContext = {
    snapshot,
    scale: createTimeScale({ range, zoom: 'week', timeZone, widthPx: 840 }),
    closedWindows: closed,
    closedWindowsOf: () => closed,
    timeZone,
    zoneLabel: false,
    hideClosed: false,
    selectedOrderId: undefined,
    selectedOrderIds: new Set<string>(),
    chainRowIds: new Set(onChain ? [jobOrderId] : []),
    machineName: (code) => code ?? 'no machine',
  };
  const row = buildGanttRows(snapshot)
    .flatMap((level1) => (level1.kind === 'order' ? jobOrderRowsOf(level1) : []))
    .find((each) => each.id === jobOrderId);
  if (row === undefined) throw new Error(`No row ${jobOrderId}`);
  const { container } = render(
    <GanttViewProvider value={view}>
      <GanttBlock row={row} selected={false} onChain={onChain} onSelect={() => {}} />
    </GanttViewProvider>,
  );
  return container;
}

describe('the outlines of a block (plan 07, Block states; WCAG 1.4.1)', () => {
  it('draws the chain outline dashed and further in than the locked outline, so they differ in shape', () => {
    const chain = renderBlock('jo-1003-10', true);
    const outline = chain.querySelector('[data-chain-outline]');

    expect(outline?.className).toContain('border-dashed');
    expect(outline?.className).toContain('inset-1.5');
    expect(chain.querySelector('[data-locked-outline]')).toBeNull();
  });

  it('keeps the locked outline beside the chain outline on a locked row of the chain', () => {
    const both = renderBlock('jo-1002-10', true);
    const locked = both.querySelector('[data-locked-outline]');

    expect(locked?.className).toContain('inset-0.5');
    expect(locked?.className).not.toContain('border-dashed');
    expect(both.querySelector('[data-chain-outline]')).not.toBeNull();
    expect(both.querySelector('[data-block]')?.getAttribute('aria-label')).toContain(
      'locked, on the critical chain',
    );
  });
});
