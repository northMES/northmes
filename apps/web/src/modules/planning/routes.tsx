// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { PlantRoute } from '@northmes/web-sdk';
import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { boardSearch } from './gantt-search.ts';

/**
 * The planning module's routes under the shell's $plant route. Each route takes its path from its
 * entry in planningLinks, so a path is written once, in the link manifest (ADR 0062). The top
 * route's path is the manifest's own, the module id. The screens load lazily from screens.ts. The
 * board route keeps its view state in the URL: view, zoom, from, order and chain (plan 18).
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
    component: lazyRouteComponent(() => import('./screens.ts'), 'BoardRoute'),
  });
  return planningRoute.addChildren([boardRoute]);
}
