// SPDX-License-Identifier: AGPL-3.0-or-later
import { type LinkNode, linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { coreModule } from '../../../src/modules/core/index.ts';

/**
 * The route pattern of a link manifest or entry and of every entry below it. The string keys of a
 * manifest and of each builder are the names of its child entries.
 */
function linkPatterns(node: LinkNode<string>): string[] {
  const children = Object.values(node) as LinkNode<string>[];
  return [linkEntry(node).pattern, ...children.flatMap(linkPatterns)];
}

/**
 * The fullPath of every route in the shell's route tree with the core module mounted. An index
 * route's fullPath ends in a slash and opens the same URL as its parent's.
 */
function routeFullPaths(): string[] {
  const router = createRouter({ routeTree: createShellRoutes({ modules: [coreModule] }) });
  const paths = Object.values(router.routesById).map((route) =>
    route.fullPath === '/' ? route.fullPath : route.fullPath.replace(/\/$/, ''),
  );
  return [...new Set(paths)];
}

describe('core routes', () => {
  it('E06-S06 every coreLinks entry, its settings section included, matches a route fullPath', () => {
    // The shell's root route, its $plant route and its company settings route, then one route per
    // link entry, of the plant pages and of the settings section, and no other.
    expect(routeFullPaths().sort()).toEqual(
      ['/', '/$plant', '/settings/$companyId', ...linkPatterns(coreLinks)].sort(),
    );
  });
});
