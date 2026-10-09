// SPDX-License-Identifier: MIT
import { createShellRoutes, defineWebModule } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

const planning = defineWebModule({
  id: 'planning',
  version: '0.4.0',
  routes: (plantRoute) => {
    const planningRoute = createRoute({ getParentRoute: () => plantRoute, path: 'planning' });
    const boardRoute = createRoute({ getParentRoute: () => planningRoute, path: 'board' });
    return planningRoute.addChildren([boardRoute]);
  },
});

const quality = defineWebModule({
  id: 'quality',
  version: '0.4.0',
  routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'quality' }),
});

describe('createShellRoutes', () => {
  it("E02-S05 createShellRoutes mounts a module's routes under /$plant/<id>, beside company settings and their landing", () => {
    const router = createRouter({
      routeTree: createShellRoutes({ modules: [planning, quality] }),
      history: createMemoryHistory(),
    });

    // routesByPath lists every route except the root, keyed by its full path.
    expect(Object.keys(router.routesByPath).sort()).toEqual([
      '/$plant',
      '/$plant/planning',
      '/$plant/planning/board',
      '/$plant/quality',
      // The landing, the index route of /settings/$companyId, has its parent's path.
      '/settings/$companyId',
    ]);
  });
});
