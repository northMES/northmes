import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface TurboTask {
  cache?: boolean;
  dependsOn?: string[];
  outputs?: string[];
}

interface TurboConfig {
  tasks?: Record<string, TurboTask>;
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

describe('tooling', () => {
  it('turbo.json caches build, typecheck and lint and defines no test task', () => {
    const tasks = readJson<TurboConfig>('turbo.json').tasks ?? {};

    for (const name of ['build', 'typecheck', 'lint']) {
      expect(tasks[name], name).toBeDefined();
      expect(tasks[name]?.cache, name).not.toBe(false);
    }
    expect(Object.keys(tasks).filter((name) => name.startsWith('test'))).toEqual([]);
  });

  it('turbo is in the strict catalog and the root devDependencies take it from the catalog', () => {
    expect(readWorkspace().catalog?.turbo).toMatch(/^2\.\d+\.\d+$/);
    expect(readJson<PackageJson>('package.json').devDependencies?.turbo).toBe('catalog:');
  });

  it('@biomejs/biome is a Biome 2.5 catalog entry that the root devDependencies take from the catalog', () => {
    expect(readWorkspace().catalog?.['@biomejs/biome']).toMatch(/^2\.5\.\d+$/);
    expect(readJson<PackageJson>('package.json').devDependencies?.['@biomejs/biome']).toBe(
      'catalog:',
    );
  });
});
