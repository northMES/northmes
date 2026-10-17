// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { boardSearch, ganttSearch } from './gantt-search.ts';

/**
 * The planning module's routes under the shell's $plant route. Each route takes its path from its
 * entry in planningLinks, so a path is written once, in the link manifest (ADR 0062). The top
 * route's path is the manifest's own, the module id. The screens load lazily from screens.ts. The
 * Gantt page keeps its view state in the URL: zoom, from, order and chain (plan 18); the board
 * route keeps the same keys and redirects the view=gantt links from before the Gantt had its own
 * page (Krister, 2026-10-17).
 */
export function planningRoutes(plantRoute: PlantRoute) {
  const planningRoute = createRoute({
    getParentRoute: () => plantRoute,
    path: linkEntry(planningLinks).path,
  });
  const boardRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.board).path,
    validateSearch: boardSearch,
    beforeLoad: ({ search, params }) => {
      if (search.view === 'gantt') {
        const { view: _, ...rest } = search;
        const query = new URLSearchParams(
          Object.entries(rest).map(([key, value]) => [key, String(value)]),
        ).toString();
        const { href } = planningLinks.gantt({ plant: params.plant });
        throw redirect({ href: query === '' ? href : `${href}?${query}`, replace: true });
      }
    },
    component: lazyRouteComponent(() => import('./screens.ts'), 'BoardScreen'),
  });
  const ganttRoute = createRoute({
    getParentRoute: () => planningRoute,
    path: linkEntry(planningLinks.gantt).path,
    validateSearch: ganttSearch,
    component: lazyRouteComponent(() => import('./screens.ts'), 'GanttScreen'),
  });
  return planningRoute.addChildren([boardRoute, ganttRoute]);
}
