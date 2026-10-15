// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule, type PlantRoute } from '@northmes/web-sdk';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type LoadPluginsOptions,
  loadPlugins,
  type PluginListing,
  UnavailablePluginPage,
} from '../../src/plugins/load-plugins.tsx';

const apiUrl = 'https://api.example';

const hello: PluginListing = {
  id: 'example-hello',
  version: '0.1.0',
  entry: '/api/v1/web/plugins/example-hello/0.1.0/entry.js',
  label: 'Hello',
  icon: 'Hand',
  order: 50,
  contributes: [],
};

const helloModule = defineWebModule({
  id: 'example-hello',
  version: '0.1.0',
  routes: (plantRoute: PlantRoute) => plantRoute,
});

/** The options of loadPlugins with a signed-in session and an API that lists `plugins`. */
function options(
  plugins: readonly PluginListing[],
  overrides: Partial<LoadPluginsOptions> = {},
): LoadPluginsOptions & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async () => Response.json({ plugins }));
  return {
    apiUrl,
    token: async () => 'jwt-1',
    fetch,
    importModule: async () => ({ default: helloModule }),
    ...overrides,
  } as LoadPluginsOptions & { fetch: ReturnType<typeof vi.fn> };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadPlugins', () => {
  it('ADR 0075 loads nothing and asks for no list while nobody is signed in', async () => {
    const opts = options([hello], { token: async () => undefined });

    expect(await loadPlugins(opts)).toEqual([]);
    expect(opts.fetch).not.toHaveBeenCalled();
  });

  it("ADR 0075 imports each listed plugin's entry from the API and gives it a sidebar group with one entry to its page", async () => {
    const importModule = vi.fn(async () => ({ default: helloModule }));
    const opts = options([{ ...hello, permission: 'example-hello.greeting:read' }], {
      importModule,
    });

    const [loaded, ...rest] = await loadPlugins(opts);

    expect(rest).toEqual([]);
    expect(opts.fetch).toHaveBeenCalledWith(
      `${apiUrl}/api/v1/web/plugins`,
      expect.objectContaining({ headers: { authorization: 'Bearer jwt-1' } }),
    );
    expect(importModule).toHaveBeenCalledWith(`${apiUrl}${hello.entry}`);
    expect(loaded?.module).toBe(helloModule);
    expect(loaded).toMatchObject({ label: 'Hello', order: 50 });
    const [link] = loaded?.links ?? [];
    expect(link).toMatchObject({
      label: 'Hello',
      icon: 'Hand',
      permission: 'example-hello.greeting:read',
    });
    expect(link && 'link' in link ? link.link({ plant: 'gothenburg' }) : undefined).toEqual({
      href: '/gothenburg/example-hello',
    });
  });

  it('ADR 0075 a plugin whose import fails, never answers or exports no web module of its id gets an unavailable entry instead', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const listings = ['failing', 'hanging', 'wrong'].map((name) => ({
      ...hello,
      id: `example-${name}`,
      label: name,
      entry: `/api/v1/web/plugins/example-${name}/0.1.0/entry.js`,
    }));
    const importModule = (url: string) => {
      if (url.includes('failing')) return Promise.reject(new Error('404'));
      if (url.includes('hanging')) return new Promise<never>(() => {});
      return Promise.resolve({ default: helloModule });
    };

    const loaded = await loadPlugins(options(listings, { importModule, timeoutMs: 10 }));

    expect(
      loaded.map(({ module, label, links }) => ({
        id: module.id,
        label,
        entry: links?.[0]?.label,
      })),
    ).toEqual([
      { id: 'example-failing', label: 'failing', entry: 'failing (unavailable)' },
      { id: 'example-hanging', label: 'hanging', entry: 'hanging (unavailable)' },
      { id: 'example-wrong', label: 'wrong', entry: 'wrong (unavailable)' },
    ]);
  });

  it("ADR 0068 a plugin's contributions carry their manifest entry and the component its web part supplies, and a plugin without routes gets no sidebar entry", async () => {
    const Count = () => <p>42 articles</p>;
    const counter = defineWebModule({
      id: 'example-article-count',
      version: '0.1.0',
      contributions: { 'example-article-count.count': Count },
    });
    const listing: PluginListing = {
      ...hello,
      id: 'example-article-count',
      label: 'Article count',
      entry: '/api/v1/web/plugins/example-article-count/0.1.0/entry.js',
      contributes: [
        {
          id: 'example-article-count.count',
          slot: 'core/dashboard/widgets/v1',
          label: 'Article count',
          order: 10,
          permission: 'core.article:read',
        },
      ],
    };

    const [loaded] = await loadPlugins(
      options([listing], { importModule: async () => ({ default: counter }) }),
    );

    expect(loaded?.links).toEqual([]);
    expect(loaded?.contributions).toEqual([
      {
        id: 'example-article-count.count',
        slot: 'core/dashboard/widgets/v1',
        label: 'Article count',
        order: 10,
        permission: 'core.article:read',
        moduleId: 'example-article-count',
        moduleLabel: 'Article count',
        Component: Count,
      },
    ]);
  });

  it('ADR 0068 the contributions of a plugin that did not load have no component, so their slot shows its fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const listing: PluginListing = {
      ...hello,
      contributes: [
        {
          id: 'example-hello.wave',
          slot: 'core/dashboard/widgets/v1',
          label: 'Wave',
          order: 10,
          permission: 'core.article:read',
        },
      ],
    };

    const [loaded] = await loadPlugins(
      options([listing], { importModule: () => Promise.reject(new Error('404')) }),
    );

    expect(loaded?.contributions?.map(({ id, Component }) => [id, Component])).toEqual([
      ['example-hello.wave', undefined],
    ]);
  });

  it('ADR 0075 a plugin list that does not load leaves the shell without plugins', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const opts = options([], { fetch: vi.fn(async () => new Response('', { status: 503 })) });

    expect(await loadPlugins(opts)).toEqual([]);
    expect(error).toHaveBeenCalled();
  });

  it('ADR 0075 a session token that fails or a plugin list that never answers leaves the shell without plugins', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const noToken = options([hello], {
      token: () => Promise.reject(new Error('offline')),
    });
    const hanging = options([hello], {
      fetch: vi.fn(() => new Promise<Response>(() => {})),
      timeoutMs: 10,
    });

    expect(await loadPlugins(noToken)).toEqual([]);
    expect(await loadPlugins(hanging)).toEqual([]);
  });
});

describe('UnavailablePluginPage', () => {
  it('ADR 0075 names the plugin that did not load and offers to reload the page', () => {
    render(<UnavailablePluginPage label="Hello" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hello is unavailable' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeDefined();
  });
});
