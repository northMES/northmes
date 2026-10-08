import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface PackageJson {
  exports?: unknown;
  scripts?: Record<string, string>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as T;
}

// Every workspace package.json that the globs in pnpm-workspace.yaml match.
function workspaceManifests(): string[] {
  const { packages = [] } = parse(readFileSync(`${root}pnpm-workspace.yaml`, 'utf8')) as {
    packages?: string[];
  };
  const matches = packages
    .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
    .filter((path) => !path.split('/').includes('node_modules'));

  return [...new Set(matches)];
}

// The workspace packages of the walking skeleton that other packages, tests or scripts import.
// apps/web and modules/planning/web have no exports: nothing imports the shell, and the shell
// loads a remote by URL.
const packagesWithExports = [
  'apps/server/package.json',
  'examples/plugin-validator/package.json',
  'modules/core/package.json',
  'modules/planning/package.json',
  'modules/planning/contracts/package.json',
  'modules/planning/domain/package.json',
  'packages/contracts/package.json',
  'packages/sdk/package.json',
  'packages/testing/package.json',
  'packages/web-build/package.json',
  'packages/web-sdk/package.json',
];
const packagesWithoutExports = ['apps/web/package.json', 'modules/planning/web/package.json'];

// The subpath entries of an exports field. A field whose keys are conditions, or a plain string,
// stands for the single entry ".".
function exportEntries(exports: unknown): [string, unknown][] {
  if (typeof exports === 'object' && exports !== null) {
    const keys = Object.keys(exports);
    if (keys.length > 0 && keys.every((key) => key.startsWith('.'))) {
      return Object.entries(exports);
    }
  }
  return [['.', exports]];
}

describe('source exports', () => {
  it('E02-S01 every workspace package lists @northmes/source before default', () => {
    const manifests = workspaceManifests();

    expect(manifests).toEqual(
      expect.arrayContaining([...packagesWithExports, ...packagesWithoutExports]),
    );
    for (const path of packagesWithExports) {
      expect(readJson<PackageJson>(path).exports, path).toBeDefined();
    }
    for (const path of manifests) {
      const { exports } = readJson<PackageJson>(path);
      if (exports === undefined) {
        continue;
      }
      for (const [subpath, target] of exportEntries(exports)) {
        const conditions = typeof target === 'object' && target !== null ? Object.keys(target) : [];

        expect(conditions[0], `${path} ${subpath}`).toBe('@northmes/source');
        expect(conditions.indexOf('default'), `${path} ${subpath}`).toBeGreaterThan(0);
      }
    }
  });

  it('E02-S01 no root or package script passes the @northmes/source condition', () => {
    // Tests and dev resolve sources through the Vitest, Vite and TypeScript configs; a script that
    // passes the condition to Node (--conditions, -C or NODE_OPTIONS) would run sources outside
    // them, and production must never see it (ADR 0058).
    const manifests = ['package.json', ...workspaceManifests()];

    expect(manifests).toContain('apps/server/package.json');
    for (const path of manifests) {
      for (const [name, command] of Object.entries(readJson<PackageJson>(path).scripts ?? {})) {
        expect(command, `${path} script ${name}`).not.toContain('@northmes/source');
      }
    }
  });
});
