// SPDX-License-Identifier: AGPL-3.0-or-later
import { type LinkNode, linkEntry } from '@northmes/contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import planningModule from '../src/module.tsx';

/**
 * The route pattern of a link manifest or entry and of every entry below it. The string keys of a
 * manifest and of each builder are the names of its child entries.
 */
function linkPatterns(node: LinkNode<string>): string[] {
  const children = Object.values(node) as LinkNode<string>[];
  return [linkEntry(node).pattern, ...children.flatMap(linkPatterns)];
}

/** The fullPath of every route in the shell's route tree with the planning module mounted. */
function routeFullPaths(): string[] {
  const router = createRouter({ routeTree: createShellRoutes({ modules: [planningModule] }) });
  return Object.values(router.routesById).map((route) => route.fullPath);
}

describe('planning routes', () => {
  it('E02-S05 every planningLinks entry matches a route fullPath', () => {
    // The shell's root route and its $plant route, then one route per link entry and no other.
    expect(routeFullPaths().sort()).toEqual(
      ['/', '/$plant', ...linkPatterns(planningLinks)].sort(),
    );
  });
});
