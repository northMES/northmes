// SPDX-License-Identifier: MIT
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));

/** A contracts package by name, with the file URL of the source its "." export names. */
interface ContractsPackage {
  readonly name: string;
  readonly entry: string;
}

interface PackageJson {
  readonly name: string;
  readonly exports: { readonly '.': { readonly '@northmes/source': string } };
}

/** @northmes/contracts and the contracts package of every module (ADR 0062). */
function contractsPackages(): ContractsPackage[] {
  return globSync(['packages/contracts/package.json', 'modules/*/contracts/package.json'], {
    cwd: root,
  })
    .sort()
    .map((path) => {
      const { name, exports } = JSON.parse(readFileSync(join(root, path), 'utf8')) as PackageJson;
      const source = join(root, dirname(path), exports['.']['@northmes/source']);
      return { name, entry: pathToFileURL(source).href };
    });
}

// Runs in a fresh Node process. A module.registerHooks resolve hook records the URL of every module
// that resolves, then each entry given on the command line is imported in turn.
const loader = `
import { registerHooks } from 'node:module';

const resolved = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    resolved.push(result.url);
    return result;
  },
});

for (const url of process.argv.slice(1)) await import(url);
process.stdout.write(JSON.stringify(resolved));
`;

/**
 * Imports `entries` the way a plugin bundle reads them: plain Node, workspace packages resolved to
 * their source through the @northmes/source condition. Returns the URL of every module that
 * resolved.
 */
function resolvedInFreshProcess(entries: readonly string[]): string[] {
  const child = spawnSync(
    process.execPath,
    ['--conditions=@northmes/source', '--input-type=module', '--eval', loader, ...entries],
    { cwd: root, encoding: 'utf8' },
  );

  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as string[];
}

/** A module of a Nest package, or of react or react-dom. */
const serverOrReact = /\/node_modules\/(@nestjs\/|react\/|react-dom\/)/;

describe('contracts packages', () => {
  it('E02-S04 importing every contracts package in a fresh process loads no @nestjs or react module', () => {
    const packages = contractsPackages();

    expect(packages.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['@northmes/contracts', '@northmes/planning-contracts']),
    );
    const resolved = resolvedInFreshProcess(packages.map(({ entry }) => entry));

    expect(resolved.filter((url) => serverOrReact.test(url))).toEqual([]);
  });
});
