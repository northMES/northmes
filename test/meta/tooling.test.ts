import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GraphQLSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import vitestConfig from '../../vitest.config.ts';

interface TurboConfig {
  globalDependencies?: string[];
  tasks?: Record<string, { cache?: boolean }>;
}

interface BiomeConfig {
  root?: boolean;
  files?: { includes?: string[] };
  linter?: {
    enabled?: boolean;
    rules?: {
      preset?: string;
      a11y?: { preset?: string };
      suspicious?: { noFocusedTests?: string; noSkippedTests?: string };
    };
  };
}

interface TsConfig {
  compilerOptions?: {
    strict?: boolean;
    moduleResolution?: string;
    customConditions?: string[];
    experimentalDecorators?: boolean;
    emitDecoratorMetadata?: boolean;
    useDefineForClassFields?: boolean;
  };
}

interface VitestConfig {
  resolve?: { conditions?: string[] };
  ssr?: { resolve?: { conditions?: string[] } };
  environments?: Record<string, { resolve?: { conditions?: string[] } }>;
  test?: { projects?: { extends?: boolean; test?: { name?: string } }[] };
}

interface WorkspaceConfig {
  catalog?: Record<string, string>;
}

interface PackageJson {
  devDependencies?: Record<string, string>;
}

interface Lockfile {
  snapshots?: Record<string, unknown>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readText(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

function readWorkspace(): WorkspaceConfig {
  return parse(readText('pnpm-workspace.yaml')) as WorkspaceConfig;
}

// The lockfile's snapshot keys for one package.
function resolutions(name: string): string[] {
  const keys = Object.keys((parse(readText('pnpm-lock.yaml')) as Lockfile).snapshots ?? {});

  return keys.filter((key) => key.startsWith(`${name}@`));
}

function readDevDependencies(): Record<string, string> {
  return readJson<PackageJson>('package.json').devDependencies ?? {};
}

interface RdjsonReport {
  diagnostics?: { code?: { value?: string }; location?: { path?: string }; severity?: string }[];
}

const biomeBin = createRequire(import.meta.url).resolve('@biomejs/biome/bin/biome');

// Biome's stdin mode prints no diagnostics, so the sources go into a temporary folder under their
// repository paths, next to a copy of the root biome.json, and Biome lints that folder.
function processEnvErrors(sources: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'northmes-biome-'));
  try {
    writeFileSync(join(dir, 'biome.json'), readText('biome.json'));
    for (const [path, source] of Object.entries(sources)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), source);
    }
    const result = spawnSync(
      process.execPath,
      [biomeBin, 'lint', '--reporter=rdjson', ...Object.keys(sources)],
      { cwd: dir, encoding: 'utf8' },
    );
    const report = JSON.parse(result.stdout) as RdjsonReport;

    return (report.diagnostics ?? [])
      .filter((d) => d.code?.value === 'lint/style/noProcessEnv' && d.severity === 'ERROR')
      .map((d) => d.location?.path ?? '')
      .sort();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('tooling', () => {
  it('turbo.json caches build, typecheck and lint and defines no test task', () => {
    const tasks = readJson<TurboConfig>('turbo.json').tasks ?? {};

    for (const name of ['build', 'typecheck', 'lint']) {
      expect(tasks[name], name).toBeDefined();
      expect(tasks[name]?.cache, name).not.toBe(false);
    }
    expect(Object.keys(tasks).filter((name) => name.startsWith('test'))).toEqual([]);
  });

  it('turbo.json sets only keys that the installed turbo schema knows', () => {
    // turbo exits with "unknown key" on any other top-level key, so a pin and its config must agree.
    const schema = readJson<{ properties: Record<string, unknown> }>(
      'node_modules/turbo/schema.json',
    );
    const known = Object.keys(schema.properties);

    for (const key of Object.keys(readJson<TurboConfig>('turbo.json'))) {
      expect(known, key).toContain(key);
    }
  });

  it('E02-S01 turbo.json hashes the root biome.json and tsconfig.base.json into every task', () => {
    // Each package lints and typechecks with these root files, which lie outside every package, so
    // without them a changed rule replays a cached lint or typecheck result.
    expect(readJson<TurboConfig>('turbo.json').globalDependencies).toEqual(
      expect.arrayContaining(['biome.json', 'tsconfig.base.json']),
    );
  });

  it('biome.json is a Biome 2.5 root config with a11y recommended, noFocusedTests and noSkippedTests as errors, and the generated paths excluded', () => {
    const biome = readJson<BiomeConfig>('biome.json');
    const rules = biome.linter?.rules;

    expect(biome.root).toBe(true);
    expect(biome.linter?.enabled).toBe(true);
    // Biome 2.5 deprecates the boolean `recommended` field in favour of `preset`.
    expect(rules?.preset).toBe('recommended');
    expect(rules?.a11y?.preset).toBe('recommended');
    expect(rules?.suspicious?.noFocusedTests).toBe('error');
    expect(rules?.suspicious?.noSkippedTests).toBe('error');
    expect(biome.files?.includes).toEqual(
      expect.arrayContaining(['!docs/sources', '!**/node_modules', '!**/dist']),
    );
  });

  it('tsconfig.base.json uses strict TypeScript 6.0 settings and the @northmes/source custom condition', () => {
    const options = readJson<TsConfig>('tsconfig.base.json').compilerOptions;

    expect(options?.strict).toBe(true);
    expect(options?.customConditions).toEqual(['@northmes/source']);
    // TypeScript ignores customConditions unless the resolution mode is node16, nodenext or bundler.
    expect(options?.moduleResolution).toBe('nodenext');
  });

  it('E02-S01 tsconfig.base.json compiles Nest decorators with their metadata', () => {
    const options = readJson<TsConfig>('tsconfig.base.json').compilerOptions;

    // Nest reads constructor parameter types from design:paramtypes, which TypeScript emits only
    // for legacy decorators with emitDecoratorMetadata. useDefineForClassFields false keeps the
    // class field semantics those decorators assume.
    expect(options?.experimentalDecorators).toBe(true);
    expect(options?.emitDecoratorMetadata).toBe(true);
    expect(options?.useDefineForClassFields).toBe(false);
  });

  it('vitest.config.ts resolves the @northmes/source condition for client and server code', () => {
    const config = vitestConfig as VitestConfig;
    const unit = config.test?.projects?.find((project) => project.test?.name === 'unit');

    expect(config.resolve?.conditions).toEqual(expect.arrayContaining(['@northmes/source']));
    expect(config.ssr?.resolve?.conditions).toEqual(expect.arrayContaining(['@northmes/source']));
    // Vitest 5 lets an inline project inherit the root options by default; saying so keeps the
    // conditions in the unit project if that default changes.
    expect(unit?.extends).toBe(true);
  });

  it('E02-S02 vitest.config.ts resolves the @northmes/source condition for the global setup files', () => {
    const config = vitestConfig as VitestConfig;

    // Vitest imports global setup files in its __vitest__ environment, so without the condition
    // apps/server's setup would load a stale dist/ build of the workspace packages.
    expect(config.environments?.__vitest__?.resolve?.conditions).toEqual(
      expect.arrayContaining(['@northmes/source']),
    );
  });

  it('E02-S01 Vitest gives transformed code the graphql copy that Node loads for dependencies', () => {
    // graphql 16 ships index.js (CommonJS, "main") and index.mjs ("module"). Nest and the gateway
    // get index.js from Node, and a second copy breaks graphql's instanceof checks (ADR 0015).
    const nodeCopy = createRequire(import.meta.url)('graphql') as typeof import('graphql');

    expect(GraphQLSchema).toBe(nodeCopy.GraphQLSchema);
  });

  it('turbo is in the strict catalog and the root devDependencies take it from the catalog', () => {
    expect(readWorkspace().catalog?.turbo).toMatch(/^2\.\d+\.\d+$/);
    expect(readDevDependencies().turbo).toBe('catalog:');
  });

  it('@biomejs/biome is a Biome 2.5 catalog entry that the root devDependencies take from the catalog', () => {
    expect(readWorkspace().catalog?.['@biomejs/biome']).toMatch(/^2\.5\.\d+$/);
    expect(readDevDependencies()['@biomejs/biome']).toBe('catalog:');
  });

  it('E02-S03 dataloader 2.2 is in the strict catalog and packages/sdk takes it from the catalog', () => {
    const sdk = JSON.parse(readText('packages/sdk/package.json')) as {
      dependencies?: Record<string, string>;
    };

    expect(readWorkspace().catalog?.dataloader).toMatch(/^2\.2\.\d+$/);
    expect(sdk.dependencies?.dataloader).toBe('catalog:');
  });

  it('E02-S01 style/noProcessEnv fails in apps/server/src and packages/contracts/src and passes in packages/sdk/src/config, tests, scripts and vitest.config.ts', () => {
    const read = 'export const port = process.env.PORT;\n';
    const failing = [
      'apps/server/src/main.ts',
      'modules/core/server/core.module.ts',
      'packages/contracts/src/index.ts',
    ];
    const passing = [
      'packages/sdk/src/config/load-env.ts',
      'apps/server/src/main.test.ts',
      'apps/server/test/global-setup.ts',
      'scripts/stack/dev.mjs',
      'vitest.config.ts',
      'playwright.config.ts',
    ];
    const sources = Object.fromEntries([...failing, ...passing].map((path) => [path, read]));

    expect(processEnvErrors(sources)).toEqual([...failing].sort());
  });

  it('E02-S01 pnpm-lock.yaml holds one @nestjs/core and one @nestjs/graphql resolution', () => {
    // A snapshot key is a version plus the peers it resolved with, and each key installs its own
    // copy. Two keys for one package mean two copies, and Nest's module and GraphQL type registries
    // stop matching across them.
    expect(resolutions('@nestjs/core')).toHaveLength(1);
    expect(resolutions('@nestjs/graphql')).toHaveLength(1);
  });

  it('E02-S01 pnpm-lock.yaml holds one @apollo/client and one graphql-ws resolution', () => {
    // @apollo/client is a shared singleton (ADR 0019), and web-build's guard fixtures build against
    // it next to web-sdk. When one importer resolves graphql-ws with another optional ws peer, its
    // @apollo/client gets a second snapshot and a second copy on disk.
    expect(resolutions('@apollo/client')).toHaveLength(1);
    expect(resolutions('graphql-ws')).toHaveLength(1);
  });

  it('E02-S01 pnpm-lock.yaml holds neither the adm-zip 0.6.0 nor the undici 7.29.0 that @module-federation/dts-plugin pins', () => {
    // Both carry high advisories (adm-zip: GHSA-7q85-xj36-vmfc, GHSA-rcw4-f5rp-g42v,
    // GHSA-j5f4-cc29-5x44, GHSA-8238-w5pm-2374; undici: GHSA-rfgv-xxqx-mfg5, GHSA-w293-vg96-wgc3)
    // in the production tree that `pnpm audit --prod --audit-level high` checks (plan 13).
    expect(resolutions('adm-zip')).not.toContain('adm-zip@0.6.0');
    expect(resolutions('undici')).not.toContain('undici@7.29.0');
  });
});
