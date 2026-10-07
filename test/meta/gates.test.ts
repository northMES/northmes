import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  scripts?: Record<string, string>;
}

interface Graph {
  nodes: { key: string; attributes: { config?: { command?: string; instructions?: string } } }[];
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as PackageJson;
}

function readGraph(path: string): Graph {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as Graph;
}

const rootScripts = readPackageJson('package.json').scripts ?? {};

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
      'vitest run',
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
      const { nodes } = readGraph(path);
      const config = (key: string) => nodes.find((node) => node.key === key)?.attributes.config;

      expect(config('tester')?.command, `${path} tester`).toBe('pnpm check');
      expect(config('coder')?.instructions, `${path} coder`).toContain('pnpm check');
    }
  });
});
