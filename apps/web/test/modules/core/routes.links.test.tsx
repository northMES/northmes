// SPDX-License-Identifier: AGPL-3.0-or-later
import { type LinkNode, linkEntry } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { createShellRoutes } from '@northmes/web-sdk';
import { createRouter } from '@tanstack/react-router';
import { cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { coreModule } from '../../../src/modules/core/index.ts';
import { renderCoreAt } from './core-app.tsx';

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
  it('E06-S06 every coreLinks entry, its settings section included, matches a route fullPath', () => {
    // The shell's root route, its $plant route and its company settings route, which are also the
    // patterns of core's manifest and of its settings section, one route per link entry, and the
    // routes that lead the old URLs with core in them to the new ones (ADR 0074).
    const expected = new Set([
      '/',
      ...linkPatterns(coreLinks),
      '/$plant/core/$',
      '/settings/$companyId/core/$',
    ]);
    expect(routeFullPaths().sort()).toEqual([...expected].sort());
  });

  it.each([
    ['/plant-a/core/articles?q=hinge', '/plant-a/articles?q=hinge'],
    [
      '/plant-a/core/articles/01920000-0000-7000-8000-0000000a0001',
      '/plant-a/articles/01920000-0000-7000-8000-0000000a0001',
    ],
    [
      '/settings/01920000-0000-7000-8000-0000000ac3e0/core/users',
      '/settings/01920000-0000-7000-8000-0000000ac3e0/users',
    ],
  ])(
    'E04-S02 the old URL %s leads to %s, so bookmarks keep working (ADR 0074)',
    async (old, now) => {
      const router = renderCoreAt(old, []);

      await waitFor(() => expect(router.state.location.href).toBe(now));
    },
  );

  it('E04-S02 an old URL keeps its search values and its hash on the way to the new one (ADR 0074)', async () => {
    const router = renderCoreAt('/plant-a/core/articles?q=fl%C3%A4ns%20dn50#rows', []);

    await waitFor(() => expect(router.state.location.pathname).toBe('/plant-a/articles'));
    expect(router.state.location.search).toMatchObject({ q: 'fläns dn50' });
    expect(router.state.location.hash).toBe('rows');
  });
});
