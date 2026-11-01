// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type LinkNode, linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createRouter } from '@tanstack/react-router';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { coreModule } from '../../../src/modules/core/index.ts';

afterEach(cleanup);

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
  it('#876 every coreLinks entry, its settings section included, matches a route fullPath', () => {
    // The shell's root route, its $plant route and its settings route, which are also the patterns
    // of core's manifest and of its settings section, and one route per link entry, with no route
    // that leads an old URL on.
    const expected = new Set(['/', ...linkPatterns(coreLinks)]);
    expect(routeFullPaths().sort()).toEqual([...expected].sort());
  });
});
