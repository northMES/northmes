// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ShellProvider } from '@northmes/web-sdk';
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { noEnteredOrders } from '../../../src/modules/planning/entered-orders.ts';
import {
  createEnteredOrdersStore,
  EnteredOrdersStoreProvider,
} from '../../../src/modules/planning/entered-orders-store.ts';
import {
  type GanttDataSource,
  type GanttLoadOptions,
  g1DataSource,
} from '../../../src/modules/planning/gantt-data.ts';
import {
  GanttSourceProvider,
  useGanttSource,
} from '../../../src/modules/planning/gantt-source-context.ts';

afterEach(cleanup);

describe('useGanttSource (#766, #768, ADR 0089)', () => {
  it('reads the row list and the chunks with the orders entered by hand and the planning rules', async () => {
    const options: GanttLoadOptions[] = [];
    const recording: GanttDataSource = {
      ...g1DataSource,
      loadRows: (filter, page, given = {}) => {
        options.push(given);
        return g1DataSource.loadRows(filter, page, given);
      },
      loadChunk: (from, to, filter, given = {}) => {
        options.push(given);
        return g1DataSource.loadChunk(from, to, filter, given);
      },
    };
    const store = createEnteredOrdersStore({
      ...noEnteredOrders,
      productionOrders: [
        {
          plant: 'pyr',
          number: 'N-1007',
          article: 'A-100',
          quantity: 10,
          deadlineDate: '2026-11-20',
          priority: null,
          color: 'palette-1',
          suppliedLines: [],
          createdAtMs: Date.UTC(2026, 10, 1),
          createdBy: 'planner',
        },
      ],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ShellProvider value={{ plant: 'pyr' }}>
        <EnteredOrdersStoreProvider value={store}>
          <GanttSourceProvider value={recording}>{children}</GanttSourceProvider>
        </EnteredOrdersStoreProvider>
      </ShellProvider>
    );
    const { result } = renderHook(() => useGanttSource(), { wrapper });

    const page = await result.current.loadRows({}, { first: 100 }, { preview: 'empty' });
    await result.current.loadChunk('2026-11-01T23:00:00Z', '2026-11-08T23:00:00Z', {});

    expect(page.orders.map((order) => order.number)).toContain('N-1007');
    expect(options[0]?.preview).toBe('empty');
    for (const given of options) {
      expect(given.entered?.productionOrders.map((order) => order.number)).toEqual(['N-1007']);
      expect(given.rules).toBeDefined();
    }
  });
});
