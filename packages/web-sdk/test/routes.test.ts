// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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
  it("#876 createShellRoutes mounts a module's routes under /$plant/<id>, beside the settings landing at /$plant/settings", () => {
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
      // The landing, the index route of /$plant/settings, has its parent's path.
      '/$plant/settings',
    ]);
  });
});
