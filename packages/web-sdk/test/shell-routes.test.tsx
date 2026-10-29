// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createShellRoutes, defineWebModule } from '@northmes/web-sdk';
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  redirect,
  useParams,
} from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const quality = defineWebModule({
  id: 'quality',
  version: '0.4.0',
  routes: (plantRoute) =>
    createRoute({
      getParentRoute: () => plantRoute,
      path: 'quality',
      component: () => <p>Quality screen</p>,
    }),
});

/**
 * A core module as ADR 0074 places it: its routes and its settings routes are pathless routes, so
 * its pages sit at /$plant/articles and /$plant/settings/users.
 */
const core = defineWebModule({
  id: 'core',
  version: '0.4.0',
  routes: (plantRoute) => {
    const coreRoute = createRoute({ getParentRoute: () => plantRoute, id: 'core' });
    return coreRoute.addChildren([
      createRoute({
        getParentRoute: () => coreRoute,
        path: 'articles',
        component: () => <h1>Articles</h1>,
      }),
    ]);
  },
  settingsRoutes: (settingsRoute) => {
    const coreRoute = createRoute({ getParentRoute: () => settingsRoute, id: 'core' });
    return coreRoute.addChildren([
      createRoute({
        getParentRoute: () => coreRoute,
        path: 'users',
        component: () => <h1>Users</h1>,
      }),
    ]);
  },
});

/** A module with the id and path id, and no screen. */
function moduleWithId(id: string) {
  return defineWebModule({
    id,
    version: '0.4.0',
    routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: id }),
  });
}

function Shell() {
  return (
    <section aria-label="Shell">
      <Outlet />
    </section>
  );
}

function Plant() {
  const { plant } = useParams({ strict: false });
  return (
    <section aria-label={`Plant ${plant}`}>
      <Outlet />
    </section>
  );
}

afterEach(cleanup);

describe('createShellRoutes', () => {
  it("E02-S05 createShellRoutes renders the root and $plant components around a module's screen", async () => {
    const router = createRouter({
      routeTree: createShellRoutes({
        modules: [quality],
        rootComponent: Shell,
        plantComponent: Plant,
      }),
      history: createMemoryHistory({ initialEntries: ['/plant-a/quality'] }),
    });

    render(<RouterProvider router={router} />);

    const shell = await screen.findByRole('region', { name: 'Shell' });
    const plant = within(shell).getByRole('region', { name: 'Plant plant-a' });
    expect(within(plant).getByText('Quality screen')).toBeDefined();
  });

  it('ADR 0068 a module whose screens are only contributions adds no route', async () => {
    const widgetsOnly = defineWebModule({ id: 'example-article-count', version: '0.0.1' });
    const router = createRouter({
      routeTree: createShellRoutes({
        modules: [quality, widgetsOnly],
        rootComponent: Shell,
        plantComponent: Plant,
      }),
      history: createMemoryHistory({ initialEntries: ['/plant-a/quality'] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Quality screen')).toBeDefined();
    expect(Object.keys(router.routesByPath)).not.toContain('/$plant/example-article-count');
  });

  it('E05-S05 a route outside the plant renders under the root, and plantBeforeLoad can send a plant path there', async () => {
    const seen: string[] = [];
    const router = createRouter({
      routeTree: createShellRoutes({
        modules: [quality],
        rootComponent: Shell,
        plantComponent: Plant,
        outsidePlantRoutes: (rootRoute) => [
          createRoute({
            getParentRoute: () => rootRoute,
            path: 'sign-in',
            component: () => <h1>Sign in</h1>,
          }),
        ],
        plantBeforeLoad: ({ location }) => {
          seen.push(location.href);
          throw redirect({ to: '/sign-in' });
        },
      }),
      history: createMemoryHistory({ initialEntries: ['/plant-a/quality?tab=open'] }),
    });

    render(<RouterProvider router={router} />);

    const heading = await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.getByRole('region', { name: 'Shell' }).contains(heading)).toBe(true);
    expect(screen.queryByText('Quality screen')).toBeNull();
    expect(seen).toEqual(['/plant-a/quality?tab=open']);
  });

  it("#876 a module's settingsRoutes mount under /$plant/settings/<id> inside the plant component, beside the shell's settings landing", async () => {
    const seen: string[] = [];
    const withSettings = defineWebModule({
      ...quality,
      settingsRoutes: (settingsRoute) =>
        createRoute({
          getParentRoute: () => settingsRoute,
          path: 'quality',
          component: () => <h1>Quality settings</h1>,
        }),
    });
    const routeTree = () =>
      createShellRoutes({
        modules: [withSettings],
        rootComponent: Shell,
        plantComponent: Plant,
        plantBeforeLoad: ({ location }) => {
          seen.push(location.href);
        },
        settingsIndexComponent: () => <h1>Settings</h1>,
      });

    const router = createRouter({
      routeTree: routeTree(),
      history: createMemoryHistory({ initialEntries: ['/plant-a/settings/quality'] }),
    });
    render(<RouterProvider router={router} />);

    const plant = await screen.findByRole('region', { name: 'Plant plant-a' });
    expect(within(plant).getByRole('heading', { name: 'Quality settings' })).toBeDefined();

    cleanup();
    const landing = createRouter({
      routeTree: routeTree(),
      history: createMemoryHistory({ initialEntries: ['/plant-a/settings'] }),
    });
    render(<RouterProvider router={landing} />);

    const landingPlant = await screen.findByRole('region', { name: 'Plant plant-a' });
    expect(within(landingPlant).getByRole('heading', { name: 'Settings' })).toBeDefined();
    expect(seen).toEqual(['/plant-a/settings/quality', '/plant-a/settings']);
  });

  it('E04-S02 a module whose settings route path differs from its id is rejected', () => {
    const misplaced = defineWebModule({
      ...quality,
      settingsRoutes: (settingsRoute) =>
        createRoute({ getParentRoute: () => settingsRoute, path: 'qa' }),
    });

    expect(() => createShellRoutes({ modules: [misplaced] })).toThrow(
      'Module quality returned its settings routes at qa; they go at quality',
    );
  });

  it("#876 core's routes mount at the plant root and its settings routes at the settings root, without its id (ADR 0074)", async () => {
    const routeTree = () =>
      createShellRoutes({
        modules: [core, quality],
        plantComponent: Plant,
      });

    const router = createRouter({
      routeTree: routeTree(),
      history: createMemoryHistory({ initialEntries: ['/plant-a/articles'] }),
    });
    render(<RouterProvider router={router} />);

    const plant = await screen.findByRole('region', { name: 'Plant plant-a' });
    expect(within(plant).getByRole('heading', { name: 'Articles' })).toBeDefined();

    cleanup();
    const settings = createRouter({
      routeTree: routeTree(),
      history: createMemoryHistory({ initialEntries: ['/plant-a/settings/users'] }),
    });
    render(<RouterProvider router={settings} />);

    const settingsPlant = await screen.findByRole('region', { name: 'Plant plant-a' });
    expect(within(settingsPlant).getByRole('heading', { name: 'Users' })).toBeDefined();
  });

  it('E04-S02 a module other than core whose routes sit at another path than its id is rejected, and so is core with a path', () => {
    const misplaced = defineWebModule({
      ...quality,
      routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'qa' }),
    });
    const coreWithPath = defineWebModule({
      ...core,
      routes: (plantRoute) => createRoute({ getParentRoute: () => plantRoute, path: 'core' }),
    });

    expect(() => createShellRoutes({ modules: [misplaced] })).toThrow(
      'Module quality returned its routes at qa; they go at quality',
    );
    expect(() => createShellRoutes({ modules: [coreWithPath] })).toThrow(
      "Module core returned its routes at core; core's routes have no path (ADR 0074)",
    );
  });

  it.each([
    ['articles', 'Module id "articles" is reserved: /$plant/articles is a core web path segment'],
    ['users', 'Module id "users" is reserved: /$plant/settings/users is a core web path segment'],
    [
      'all-pages',
      'Module id "all-pages" is reserved: /$plant/all-pages is a shell web path segment',
    ],
    ['settings', 'Module id "settings" is reserved: /$plant/settings is a shell web path segment'],
  ])(
    "E04-S02 a module whose id is a top-level path segment of core's or the shell's routes, such as %s, is rejected (ADR 0074)",
    (id, message) => {
      expect(() =>
        createShellRoutes({
          modules: [core, moduleWithId(id)],
          plantShellRoutes: (plantRoute) => [
            createRoute({ getParentRoute: () => plantRoute, path: 'all-pages' }),
          ],
        }),
      ).toThrow(message);
    },
  );
});
