import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import vitestConfig from '../../vitest.config.ts';

interface TurboConfig {
  agentGuidance?: boolean;
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
  };
}

interface VitestConfig {
  resolve?: { conditions?: string[] };
  ssr?: { resolve?: { conditions?: string[] } };
  test?: { projects?: { extends?: boolean; test?: { name?: string } }[] };
}

interface WorkspaceConfig {
  catalog?: Record<string, string>;
}

interface PackageJson {
  devDependencies?: Record<string, string>;
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

function readDevDependencies(): Record<string, string> {
  return readJson<PackageJson>('package.json').devDependencies ?? {};
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

  it('turbo.json opts out of the AGENTS.md block that turbo 2.11 maintains', () => {
    // AGENTS.md is written by hand; turbo 2.11 appends its own block to it when an agent runs turbo.
    expect(readJson<TurboConfig>('turbo.json').agentGuidance).toBe(false);
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

  it('vitest.config.ts resolves the @northmes/source condition for client and server code', () => {
    const config = vitestConfig as VitestConfig;
    const unit = config.test?.projects?.find((project) => project.test?.name === 'unit');

    expect(config.resolve?.conditions).toEqual(expect.arrayContaining(['@northmes/source']));
    expect(config.ssr?.resolve?.conditions).toEqual(expect.arrayContaining(['@northmes/source']));
    // Vitest 5 lets an inline project inherit the root options by default; saying so keeps the
    // conditions in the unit project if that default changes.
    expect(unit?.extends).toBe(true);
  });

  it('turbo is in the strict catalog and the root devDependencies take it from the catalog', () => {
    expect(readWorkspace().catalog?.turbo).toMatch(/^2\.\d+\.\d+$/);
    expect(readDevDependencies().turbo).toBe('catalog:');
  });

  it('@biomejs/biome is a Biome 2.5 catalog entry that the root devDependencies take from the catalog', () => {
    expect(readWorkspace().catalog?.['@biomejs/biome']).toMatch(/^2\.5\.\d+$/);
    expect(readDevDependencies()['@biomejs/biome']).toBe('catalog:');
  });
});
