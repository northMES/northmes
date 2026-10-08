// SPDX-License-Identifier: MIT
import { createShellRoutes, defineWebModule } from '@northmes/web-sdk';
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

function Plant() {
  const { plant } = useParams({ strict: false });
  return (
    <section aria-label={`Plant ${plant}`}>
      <Outlet />
    </section>
  );
}

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
});
