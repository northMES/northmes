import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface PackageJson {
  scripts?: Record<string, string>;
}

interface Graph {
  nodes: { key: string; attributes: { config?: { command?: string; instructions?: string } } }[];
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as T;
}

// The root manifest and every workspace package.json that the globs in pnpm-workspace.yaml match.
function workspaceManifests(): string[] {
  const { packages = [] } = parse(readFileSync(`${root}pnpm-workspace.yaml`, 'utf8')) as {
    packages?: string[];
  };
  const matches = packages
    .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
    .filter((path) => !path.split('/').includes('node_modules'));

  return ['package.json', ...new Set(matches)];
}

const rootScripts = readJson<PackageJson>('package.json').scripts ?? {};

describe('gates', () => {
  it('test:handoff runs pnpm check', () => {
    expect(rootScripts['test:handoff']).toBe('pnpm check');
  });

  it('the other root scripts exist', () => {
    expect(rootScripts.gen).toBe('node scripts/gen.mjs');
    expect(rootScripts.test).toBe('vitest run');
    expect(rootScripts['test:unit']).toBe('vitest run --project unit');
    expect(rootScripts['test:int']).toBe('vitest run --project integration');
    expect(rootScripts['test:tz']).toBe('vitest run --project tz');
  });

  it('lint, typecheck and build go through turbo', () => {
    expect(rootScripts.lint).toBe('turbo run lint');
    expect(rootScripts.typecheck).toBe('turbo run typecheck');
    expect(rootScripts.build).toBe('turbo run build');
  });

  it('pnpm check runs the Node check first, then lint, typecheck, gen --check and vitest in that order', () => {
    expect(rootScripts.check?.split(' && ')).toEqual([
      'node scripts/check-node.mjs',
      'turbo run lint typecheck',
      'pnpm gen --check',
      // The web project is absent on purpose until #301 adds it.
      'vitest run --project unit --project integration --project types',
    ]);
  });

  it('check:full runs check and test:tz', () => {
    expect(rootScripts['check:full']).toBe('pnpm check && pnpm test:tz');
  });

  it('the Tester command in every graph under docs/agents/handoff/graphs is pnpm check, and its coder instruction names pnpm check', () => {
    const graphs = globSync('docs/agents/handoff/graphs/*.json', { cwd: root });
    expect(graphs, 'graph files').not.toHaveLength(0);

    // The graphs also hold a `tdd-check` node of type tester, so nodes are found by key.
    for (const path of graphs) {
      const { nodes } = readJson<Graph>(path);
      const config = (key: string) => nodes.find((node) => node.key === key)?.attributes.config;

      expect(config('tester')?.command, `${path} tester`).toBe('pnpm check');
      expect(config('coder')?.instructions, `${path} coder`).toContain('pnpm check');
    }
  });

  it('no root or package script contains cd', () => {
    // `cd` as a command word: at the start, or after whitespace, `;`, `&`, `|` or `(`.
    const cd = /(^|[\s;&|(])cd(\s|$)/;

    for (const path of workspaceManifests()) {
      for (const [name, command] of Object.entries(readJson<PackageJson>(path).scripts ?? {})) {
        expect(command, `${path} script ${name}`).not.toMatch(cd);
      }
    }
  });
});
