// SPDX-License-Identifier: MIT
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

function Shell() {
  return (
    <section aria-label="Shell">
      <Outlet />
    </section>
  );
}

function CompanySettings() {
  const { companyId } = useParams({ strict: false });
  return (
    <section aria-label={`Settings of ${companyId}`}>
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

  it("E04-S02 a module's settingsRoutes mount under /settings/$companyId/<id> inside the settings component, beside the shell's landing", async () => {
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
        settingsComponent: CompanySettings,
        settingsIndexComponent: () => <h1>Company settings</h1>,
        settingsBeforeLoad: ({ location }) => {
          seen.push(location.href);
        },
      });
    const companyId = '01920000-0000-7000-8000-0000000ac3e0';

    const router = createRouter({
      routeTree: routeTree(),
      history: createMemoryHistory({ initialEntries: [`/settings/${companyId}/quality`] }),
    });
    render(<RouterProvider router={router} />);

    const settings = await screen.findByRole('region', { name: `Settings of ${companyId}` });
    expect(within(settings).getByRole('heading', { name: 'Quality settings' })).toBeDefined();
    expect(screen.queryByRole('region', { name: /^Plant/ })).toBeNull();

    cleanup();
    const landing = createRouter({
      routeTree: routeTree(),
      history: createMemoryHistory({ initialEntries: [`/settings/${companyId}`] }),
    });
    render(<RouterProvider router={landing} />);

    expect(await screen.findByRole('heading', { name: 'Company settings' })).toBeDefined();
    expect(seen).toEqual([`/settings/${companyId}/quality`, `/settings/${companyId}`]);
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
});
