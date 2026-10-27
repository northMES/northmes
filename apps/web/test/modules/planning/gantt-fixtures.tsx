// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import {
  type BoardFieldsStore,
  BoardFieldsStoreProvider,
  createG1BoardFieldsStore,
} from '../../../src/modules/planning/board-fields-store.ts';
import type { GanttDataSource, GanttSnapshot } from '../../../src/modules/planning/gantt-data.ts';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { GanttSourceProvider } from '../../../src/modules/planning/gantt-source-context.ts';
import { shellModules } from '../../../src/modules.ts';
import { createShellRouter } from '../../../src/shell/index.ts';
import { fakeSession } from '../../auth/fake-session.ts';
import { companies, fakeApi, viewer } from '../../settings-fixtures.tsx';

/** The seed plant the specs work in. */
export const plant = 'plant-a';

/** The planning pages a test renders the shell at. */
export type PlanningPage = 'board' | 'gantt' | 'jobOrders' | 'orders' | 'customerOrders';

/** A planning href of the plant with a search, such as the Gantt page with "?zoom=week". */
export function planningHref(page: PlanningPage, search: Record<string, string | number>): string {
  const query = new URLSearchParams(
    Object.entries(search).map(([key, value]) => [key, String(value)]),
  ).toString();
  return `${planningLinks[page]({ plant }).href}${query === '' ? '' : `?${query}`}`;
}

/**
 * Renders the shell at a planning URL for a signed-in planner, the Gantt page unless another is
 * named, with a fake API that answers the shell's queries, and returns the router, whose location
 * the tests read for the view state. The planning pages read the fixture G1 unless a source is
 * given.
 */
export function renderGanttRoute(
  search: Record<string, string | number>,
  source?: GanttDataSource,
  page: PlanningPage = 'gantt',
  store?: BoardFieldsStore,
) {
  return renderPlanningAt(planningHref(page, search), source, store);
}

/**
 * Renders the shell at any planning href for a signed-in planner, such as an order's page, with
 * the fake API of renderGanttRoute; the planning pages read the fixture G1 unless a source is given,
 * and a fresh store of G1's board fields unless a store is given (#762).
 */
export function renderPlanningAt(href: string, source?: GanttDataSource, store?: BoardFieldsStore) {
  const { fetch } = fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer(['planning.productionOrder:read'], []),
  });
  const router = createShellRouter(shellModules, {
    session: fakeSession(),
    fetch,
    history: createMemoryHistory({ initialEntries: [href] }),
  });
  render(
    <BoardFieldsStoreProvider value={store ?? createG1BoardFieldsStore()}>
      <GanttSourceProvider value={source ?? g1DataSource}>
        <RouterProvider router={router} />
      </GanttSourceProvider>
    </BoardFieldsStoreProvider>,
  );
  return router;
}

/**
 * The treegrid of the order Gantt, once it has rendered; also while the Details drawer, a modal
 * sheet, keeps the page behind it inert.
 */
export async function findGantt(): Promise<HTMLElement> {
  return screen.findByRole('treegrid', { name: /order Gantt/, hidden: true });
}

/** A data source that answers every load with one snapshot, for a test with changed data. */
export function sourceOf(snapshot: GanttSnapshot): GanttDataSource {
  return { load: async () => snapshot };
}

/** The accessible text of the markers of a kind inside an element, as the layer records it. */
export function markerTexts(element: HTMLElement, kind: string): string[] {
  return Array.from(element.querySelectorAll(`[data-marker="${kind}"]`)).map(
    (marker) => marker.getAttribute('data-accessible-text') ?? '',
  );
}

/** The Details drawer, once it has opened; it is named after the row it shows. */
export async function findDetails(): Promise<HTMLElement> {
  return waitFor(() => {
    const drawer = document.querySelector<HTMLElement>('[role="dialog"][data-details-drawer]');
    if (drawer === null) throw new Error('The Details drawer is not open');
    return drawer;
  });
}

/** Whether the Details drawer is open. */
export function detailsOpen(): boolean {
  return document.querySelector('[role="dialog"][data-details-drawer]') !== null;
}
