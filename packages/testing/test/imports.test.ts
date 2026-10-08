// SPDX-License-Identifier: MIT
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = fileURLToPath(new URL('../src/', import.meta.url));

interface WorkspacePackage {
  /** The package's folder from the repository root, with a trailing separator. */
  readonly folder: string;
  readonly name: string;
  readonly license: string;
}

/** The repository's packages outside docs/, whose spikes keep copies of the real packages. */
function workspacePackages(): WorkspacePackage[] {
  return globSync('**/package.json', {
    cwd: root,
    exclude: ['**/node_modules', 'docs', '**/dist'],
  }).map((path) => {
    const { name, license } = JSON.parse(readFileSync(join(root, path), 'utf8')) as {
      name: string;
      license: string;
    };
    const folder = dirname(path);
    return { folder: folder === '.' ? '' : `${folder}${sep}`, name, license };
  });
}

/** The specifiers of every static import, export from, side-effect import and dynamic import. */
function specifiers(text: string): string[] {
  const pattern =
    /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...text.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
}

/** The workspace package that holds a path from the repository root: the deepest folder. */
function packageOf(
  path: string,
  packages: readonly WorkspacePackage[],
): WorkspacePackage | undefined {
  return packages
    .filter(({ folder }) => path.startsWith(folder))
    .sort((a, b) => b.folder.length - a.folder.length)[0];
}

describe('the license boundary of @northmes/testing', () => {
  // AGENTS.md: an MIT package imports only MIT or other permissive code, never the AGPL modules.
  it('E02-S02 @northmes/testing imports nothing from apps/backend or the modules', () => {
    const packages = workspacePackages();
    const agpl = packages.filter(({ license }) => license !== 'MIT');
    const files = globSync('**/*.ts', { cwd: source });
    const agplImports = files.flatMap((file) =>
      specifiers(readFileSync(join(source, file), 'utf8'))
        .filter((specifier) => {
          if (specifier.startsWith('.')) {
            const target = relative(root, resolve(dirname(join(source, file)), specifier));
            return packageOf(target, packages)?.license !== 'MIT';
          }
          return agpl.some(({ name }) => specifier === name || specifier.startsWith(`${name}/`));
        })
        .map((specifier) => `${file}: ${specifier}`),
    );

    expect(agpl.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['@northmes/backend', '@northmes/web']),
    );
    expect(files).toEqual(expect.arrayContaining(['database.ts', 'db-command.ts', 'given.ts']));
    expect(agplImports).toEqual([]);
  });
});
