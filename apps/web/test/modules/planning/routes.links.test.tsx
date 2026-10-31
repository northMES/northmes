// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type LinkNode, linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { planningModule } from '../../../src/modules/planning/index.ts';

/**
 * The route pattern of a link manifest or entry and of every entry below it. The string keys of a
 * manifest and of each builder are the names of its child entries.
 */
function linkPatterns(node: LinkNode<string>): string[] {
  const children = Object.values(node) as LinkNode<string>[];
  return [linkEntry(node).pattern, ...children.flatMap(linkPatterns)];
}

/**
 * The fullPath of every route in the shell's route tree with the planning module mounted, each
 * once. An index route's fullPath ends in a slash and opens the same URL as its parent's.
 */
function routeFullPaths(): string[] {
  const router = createRouter({ routeTree: createShellRoutes({ modules: [planningModule] }) });
  return [
    ...new Set(
      Object.values(router.routesById).map((route) =>
        route.fullPath === '/' ? route.fullPath : route.fullPath.replace(/\/$/, ''),
      ),
    ),
  ];
}

afterEach(cleanup);

describe('planning routes', () => {
  it('#876 every planningLinks entry, its settings section included, matches a route fullPath', () => {
    // The shell's root route, its $plant route and its settings route with the landing, one route
    // per link entry, and the route that leads the old settings URLs under the plant's settings.
    expect(routeFullPaths().sort()).toEqual(
      [
        ...new Set([
          '/',
          '/$plant',
          '/$plant/settings',
          ...linkPatterns(planningLinks),
          '/$plant/planning/settings/$',
        ]),
      ].sort(),
    );
  });

  it.each([
    ['/plant-a/planning/settings', '/plant-a/settings/planning'],
    [
      '/plant-a/planning/settings/board-fields?preview=loading',
      '/plant-a/settings/planning/board-fields?preview=loading',
    ],
  ])(
    "#876 the old planning settings URL %s leads to %s, under the plant's settings",
    async (old, now) => {
      const router = createRouter({
        routeTree: createShellRoutes({ modules: [planningModule] }),
        history: createMemoryHistory({ initialEntries: [old] }),
      });
      render(<RouterProvider router={router} />);

      await waitFor(() => expect(router.state.location.href).toBe(now));
    },
  );
});
