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

// The projects that a vitest command names with `--project`, in order.
function projectsOf(command = ''): string[] {
  return [...command.matchAll(/--project[= ](\S+)/g)].map((match) => match[1] ?? '');
}

const rootScripts = readJson<PackageJson>('package.json').scripts ?? {};

describe('gates', () => {
  it('test:handoff runs pnpm check', () => {
    expect(rootScripts['test:handoff']).toBe('pnpm check');
  });

  it('the other root scripts exist', () => {
    expect(rootScripts.gen).toBe('node scripts/gen.mjs');
    expect(rootScripts['test:unit']).toBe('vitest run --project unit');
    expect(rootScripts['test:int']).toBe('vitest run --project integration');
    expect(rootScripts['test:ai']).toBe('vitest run --project ai');
  });

  // The Stockholm leg runs the unit and integration projects with Node and the test Postgres in
  // Europe/Stockholm. TZ goes on the command line, because set through Vitest's env option or a
  // setup file it has no effect on Date (docs/plan/11-quality-and-testing.md).
  it('pnpm test:tz runs the unit and integration projects with TZ and NM_TEST_PG_TZ set to Europe/Stockholm', () => {
    expect(rootScripts['test:tz']).toBe(
      'TZ=Europe/Stockholm NM_TEST_PG_TZ=Europe/Stockholm vitest run --project unit --project integration',
    );
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
      'vitest run --project unit --project integration --project web --project types',
    ]);
  });

  // An unfiltered `vitest run` would also run the ai and ops projects, and *.ai.test.ts runs only
  // through `pnpm test:ai` (AGENTS.md).
  it('pnpm test runs the unit, integration, web and types projects and never ai or ops', () => {
    const checkVitest = rootScripts.check?.split(' && ').find((c) => c.startsWith('vitest run'));

    expect(projectsOf(rootScripts.test)).toEqual(['unit', 'integration', 'web', 'types']);
    expect(projectsOf(rootScripts.test)).toEqual(projectsOf(checkVitest));
  });

  it('check:full runs check, test:tz and e2e', () => {
    expect(rootScripts['check:full']).toBe('pnpm check && pnpm test:tz && pnpm e2e');
  });

  it('E02-S01 the root scripts northmes, gen:migration, plugin:build, dev, demo and e2e exist', () => {
    // pnpm appends the arguments of `pnpm northmes db bootstrap` after dist/main.js.
    expect(rootScripts.northmes).toBe(
      'turbo run build --filter=@northmes/backend --output-logs=errors-only && node apps/backend/dist/main.js',
    );
    expect(rootScripts['gen:migration']).toBe('node scripts/gen-migration.mjs');
    // scripts/plugin-build.mjs imports the SDK's dist/, which a fresh clone does not have.
    expect(rootScripts['plugin:build']).toBe(
      'turbo run build --filter=@northmes/sdk --output-logs=errors-only && node scripts/plugin-build.mjs',
    );
    expect(rootScripts.dev).toBe('node scripts/stack/dev.mjs');
    expect(rootScripts.demo).toBe('node scripts/stack/demo.mjs');
    expect(rootScripts.e2e).toBe('pnpm build && playwright test');
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
