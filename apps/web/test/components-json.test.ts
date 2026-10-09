// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ComponentsJson {
  style?: string;
  rsc?: boolean;
  tsx?: boolean;
  tailwind?: { config?: string; css?: string; cssVariables?: boolean };
  iconLibrary?: string;
  aliases?: Record<string, string>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')) as T;
}

/** The folder under apps/web that an alias names, through the package.json imports of apps/web. */
function folderOf(alias: string, imports: Record<string, string>): string | undefined {
  for (const [key, target] of Object.entries(imports)) {
    const prefix = key.replace(/\*$/, '');
    if (key.endsWith('*') && alias.startsWith(prefix)) {
      return target.replace(/^\.\//, '').replace(/\*$/, alias.slice(prefix.length));
    }
  }
  return undefined;
}

describe('the shadcn CLI configuration', () => {
  it('E04-S01 the utils alias resolves to a module that exports cn, for a component that imports it', async () => {
    const { aliases = {} } = readJson<ComponentsJson>('components.json');
    const { imports = {} } = readJson<{ imports?: Record<string, string> }>('package.json');
    const folder = folderOf(aliases.utils ?? '', imports);

    const utils = (await import(new URL(`../${folder}.ts`, import.meta.url).href)) as {
      cn?: (...classes: string[]) => string;
    };

    expect(utils.cn?.('px-2', 'px-4')).toBe('px-4');
  });

  it('E04-S01 components.json adds Base UI primitives for Tailwind 4 with CSS variables and lucide icons', () => {
    const config = readJson<ComponentsJson>('components.json');

    // ADR 0020 picks shadcn on Base UI: the style's base- prefix selects Base UI's registry.
    expect(config.style).toMatch(/^base-/);
    expect(config).toMatchObject({
      rsc: false,
      tsx: true,
      tailwind: { config: '', css: 'src/styles/app.css', cssVariables: true },
      iconLibrary: 'lucide',
    });
  });

  it('E04-S01 the shadcn aliases resolve through package.json imports to src/ui/primitives and src/ui/lib', () => {
    const { aliases = {} } = readJson<ComponentsJson>('components.json');
    const { imports = {} } = readJson<{ imports?: Record<string, string> }>('package.json');

    // A wildcard target without an extension makes the CLI write imports with the file's own
    // extension, as every other import in src does.
    expect(imports['#ui/*']).toBe('./src/ui/*');
    expect(
      Object.fromEntries(
        Object.entries(aliases).map(([name, alias]) => [name, folderOf(alias, imports)]),
      ),
    ).toEqual({
      components: 'src/ui/components',
      ui: 'src/ui/primitives',
      utils: 'src/ui/lib/utils',
      lib: 'src/ui/lib',
      hooks: 'src/ui/lib',
    });
  });
});
