// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type LinkNode, linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createRouter } from '@tanstack/react-router';
import { cleanup } from '@testing-library/react';
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
    // The shell's root route, its $plant route and its settings route with the landing, and one
    // route per link entry, with no route that leads an old URL on.
    expect(routeFullPaths().sort()).toEqual(
      [
        ...new Set([
          '/',
          '/$plant',
          '/$plant/settings',
          ...linkPatterns(planningLinks),
        ]),
      ].sort(),
    );
  });
});
