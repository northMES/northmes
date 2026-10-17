// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import type { GanttDataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { GanttSourceProvider } from '../../../src/modules/planning/gantt-source-context.ts';
import { shellModules } from '../../../src/modules.ts';
import { createShellRouter } from '../../../src/shell/index.ts';
import { fakeSession } from '../../auth/fake-session.ts';
import { companies, fakeApi, viewer } from '../../settings-fixtures.tsx';

/** The seed plant the specs work in. */
export const plant = 'plant-a';

/** The board href of the plant with a search, such as "?view=gantt&zoom=week". */
export function boardHref(search: Record<string, string | number>): string {
  const query = new URLSearchParams(
    Object.entries(search).map(([key, value]) => [key, String(value)]),
  ).toString();
  return `${planningLinks.board({ plant }).href}${query === '' ? '' : `?${query}`}`;
}

/**
 * Renders the shell at a board URL for a signed-in planner, with a fake API that answers the
 * shell's queries and the board stub's with no orders, and returns the router, whose location the
 * tests read for the view state. The Gantt reads the fixture G1 unless a source is given.
 */
export function renderBoardRoute(
  search: Record<string, string | number>,
  source?: GanttDataSource,
) {
  const { fetch } = fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer(['planning.productionOrder:read'], []),
    PlanningBoard: () => ({ planningProductionOrders: [] }),
  });
  const router = createShellRouter(shellModules, {
    session: fakeSession(),
    fetch,
    history: createMemoryHistory({ initialEntries: [boardHref(search)] }),
  });
  render(
    <GanttSourceProvider value={source ?? g1DataSource}>
      <RouterProvider router={router} />
    </GanttSourceProvider>,
  );
  return router;
}

/** The treegrid of the order Gantt, once it has rendered. */
export async function findGantt(): Promise<HTMLElement> {
  return screen.findByRole('treegrid', { name: /order Gantt/ });
}
