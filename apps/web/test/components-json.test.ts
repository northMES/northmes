// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/** The folder of apps/web that Node resolves an alias to, through the package.json imports. */
function folderOf(alias: string): string {
  const web = fileURLToPath(new URL('..', import.meta.url));
  return relative(web, fileURLToPath(import.meta.resolve(alias)));
}

describe('the shadcn CLI configuration', () => {
  it('E04-S01 the utils alias resolves to a module that exports cn, for a component that imports it', async () => {
    const { aliases = {} } = readJson<ComponentsJson>('components.json');

    const utils = (await import(`${import.meta.resolve(aliases.utils ?? '')}.ts`)) as {
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
      Object.fromEntries(Object.entries(aliases).map(([name, alias]) => [name, folderOf(alias)])),
    ).toEqual({
      components: 'src/ui/components',
      ui: 'src/ui/primitives',
      utils: 'src/ui/lib/utils',
      lib: 'src/ui/lib',
      hooks: 'src/ui/lib',
    });
  });
});
