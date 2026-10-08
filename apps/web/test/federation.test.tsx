// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { fetchModuleList, type ListedModule } from '../src/federation.ts';

const planning: ListedModule = {
  id: 'planning',
  version: '0.4.0',
  remoteName: 'planning',
  label: 'Planning',
  order: 20,
  manifestUrl: '/modules/planning/0.4.0/mf-manifest.json',
  integrity: 'sha384-planning',
};

describe('the shell', () => {
  it('E02-S05 the shell requests the module list from apiPath(web, modules)', async () => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ northmes: '0.4.0', supergraph: null, modules: [planning] }), {
          headers: { 'content-type': 'application/json' },
        }),
    );

    expect(await fetchModuleList(fetch)).toEqual([planning]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/v1/web/modules');
  });
});
