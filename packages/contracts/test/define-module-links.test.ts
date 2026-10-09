// SPDX-License-Identifier: MIT
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineModuleLinks, linkEntry } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

// The packages that packages/contracts lists in any dependency field of its package.json.
function declaredPackages(): string[] {
  const manifest = JSON.parse(readFileSync(`${packageRoot}package.json`, 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >;
  const fields = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];
  return fields.flatMap((field) => Object.keys(manifest[field] ?? {}));
}

// Each import specifier in the package's src files, as "<file>: <specifier>".
function sourceImports(): string[] {
  return globSync('src/**/*.ts', { cwd: packageRoot }).flatMap((file) => {
    const text = readFileSync(`${packageRoot}${file}`, 'utf8');
    return [...text.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map(
      (match) => `${file}: ${match[1]}`,
    );
  });
}

const links = defineModuleLinks('planning', {
  orders: { path: 'orders', children: { order: { path: '$orderId' } } },
});

describe('defineModuleLinks', () => {
  it('E02-S05 order({ plant: plant-a, orderId: a/b }).href is /plant-a/planning/orders/a%2Fb', () => {
    expect(links.orders.order({ plant: 'plant-a', orderId: 'a/b' }).href).toBe(
      '/plant-a/planning/orders/a%2Fb',
    );
  });

  it('E02-S05 an empty orderId throws', () => {
    expect(() => links.orders.order({ plant: 'plant-a', orderId: '' })).toThrow(
      'Link /$plant/planning/orders/$orderId has an empty value for orderId',
    );
  });

  it('E02-S05 a . or .. param value throws, because URL parsing would drop it or climb out', () => {
    expect(new URL('/plant-a/planning/orders/..', 'http://localhost').pathname).toBe(
      '/plant-a/planning/',
    );
    for (const orderId of ['.', '..']) {
      expect(() => links.orders.order({ plant: 'plant-a', orderId }), orderId).toThrow(
        `Link /$plant/planning/orders/$orderId has the value ${JSON.stringify(orderId)} for orderId, which is not a path segment`,
      );
    }
  });

  it('E02-S05 an entry named like a function property, such as name or call, throws', () => {
    for (const name of ['name', 'call']) {
      expect(() => defineModuleLinks('planning', { [name]: { path: 'x' } }), name).toThrow(
        `Link entry ${name} under /$plant/planning has the name of a function property`,
      );
    }
  });

  it('E02-S05 a builder returns its route pattern as to, with the params and search it was given', () => {
    expect(links.orders({ plant: 'plant-a' }, { q: '1001' })).toEqual({
      to: '/$plant/planning/orders',
      params: { plant: 'plant-a' },
      search: { q: '1001' },
      href: '/plant-a/planning/orders?q=1001',
    });
  });

  it('E02-S05 the href encodes each search key and value and leaves out empty values', () => {
    const link = links.orders({ plant: 'plant-a' }, { q: 'a&b c#d', 'x=y': '1', sort: '' });

    expect(link.href).toBe('/plant-a/planning/orders?q=a%26b%20c%23d&x%3Dy=1');
    expect(new URL(link.href, 'http://localhost').searchParams.get('q')).toBe('a&b c#d');
  });

  it("E02-S05 linkEntry reads an entry's path below its parent and its route pattern, and the entry's keys stay its children", () => {
    expect(linkEntry(links.orders.order)).toEqual({
      path: '$orderId',
      pattern: '/$plant/planning/orders/$orderId',
    });
    expect(linkEntry(links.orders)).toEqual({ path: 'orders', pattern: '/$plant/planning/orders' });
    expect(Object.keys(links.orders)).toEqual(['order']);
  });

  it("E02-S05 linkEntry reads the module id as the manifest's path below /$plant, and the manifest's keys stay its entries", () => {
    expect(linkEntry(links)).toEqual({ path: 'planning', pattern: '/$plant/planning' });
    expect(Object.keys(links)).toEqual(['orders']);
  });

  it("E02-S05 linkEntry of a second copy of @northmes/contracts reads the entries the first copy's defineModuleLinks built", async () => {
    // A plugin bundle carries its own copy of @northmes/contracts, and the web app reads the
    // plugin's manifest with its own copy. The query gives a second instance of the module.
    const copyPath: string = '../src/define-module-links.ts?copy';
    const copy: typeof import('../src/define-module-links.ts') = await import(
      /* @vite-ignore */ copyPath
    );

    expect(copy.linkEntry).not.toBe(linkEntry);
    expect(copy.linkEntry(links.orders.order)).toEqual({
      path: '$orderId',
      pattern: '/$plant/planning/orders/$orderId',
    });
  });

  it('E04-S02 a settings section builder builds /settings/<company id>/core/plants without a plant', () => {
    const companyId = '01920000-0000-7000-8000-0000000ac3e0';
    const core = defineModuleLinks(
      'core',
      { articles: { path: 'articles' } },
      { settings: { plants: { path: 'plants', children: { plant: { path: '$plantId' } } } } },
    );

    expect(core.settings.plants({ companyId }).href).toBe(`/settings/${companyId}/core/plants`);
    expect(core.settings.plants.plant({ companyId, plantId: 'p/1' })).toEqual({
      to: '/settings/$companyId/core/plants/$plantId',
      params: { companyId, plantId: 'p/1' },
      search: {},
      href: `/settings/${companyId}/core/plants/p%2F1`,
    });
    expect(linkEntry(core.settings)).toEqual({
      path: 'core',
      pattern: '/settings/$companyId/core',
    });
    expect(linkEntry(core.settings.plants)).toEqual({
      path: 'plants',
      pattern: '/settings/$companyId/core/plants',
    });
    expect(Object.keys(core.settings)).toEqual(['plants']);
    expect(core.articles({ plant: 'plant-a' }).href).toBe('/plant-a/core/articles');
  });

  it('E04-S02 a manifest without a settings section has no settings entry, and an entry named settings beside a settings section throws', () => {
    expect('settings' in links).toBe(false);
    expect(() =>
      defineModuleLinks(
        'planning',
        { settings: { path: 'settings' } },
        { settings: { rules: { path: 'rules' } } },
      ),
    ).toThrow('Module planning has an entry named settings and a settings section');
  });

  it('E02-S05 packages/contracts declares and imports no router package', () => {
    const imports = sourceImports();

    expect(imports, 'the scan finds the imports in src').toContain('src/index.ts: ./api-path.ts');
    expect([...declaredPackages(), ...imports].filter((name) => /router/i.test(name))).toEqual([]);
  });
});
