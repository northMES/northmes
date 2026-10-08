// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Every in-repo manifest, relative to the repository root. docs/sources holds the spike's copies.
function manifestPaths(): string[] {
  return globSync('**/northmes.module.ts', {
    cwd: root,
    exclude: ['**/node_modules', '**/dist', 'docs'],
  }).sort();
}

// Runs in a fresh Node process. A module.registerHooks resolve hook records the URL of every module
// that resolves, then each manifest given on the command line is imported in turn.
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

const manifests = [];
for (const url of process.argv.slice(1)) {
  const { default: manifest } = await import(url);
  manifests.push({ url, id: manifest.id });
}
process.stdout.write(JSON.stringify({ resolved, manifests }));
`;

// The static import and re-export statements of a module, read with the TypeScript parser, each
// with its whitespace collapsed and its closing semicolon kept when it has one. Lazy entries such
// as `server: () => import('./server/core.module.js')` are expressions, not import statements.
function importLines(source: string): string[] {
  const file = ts.createSourceFile('northmes.module.ts', source, ts.ScriptTarget.Latest);
  return file.statements
    .filter(
      (statement) =>
        ts.isImportDeclaration(statement) ||
        (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined),
    )
    .map((statement) => statement.getText(file).replace(/\s+/g, ' '));
}

// What a manifest may import: defineModule from the SDK root and the version of its own package.
const allowedImports = [
  /^import \{ defineModule \} from '@northmes\/sdk';$/,
  /^import \w+ from '\.\/package\.json' with \{ type: 'json' \};$/,
];

// The import lines of a manifest source that allowedImports does not permit.
function disallowedImports(source: string): string[] {
  return importLines(source).filter(
    (line) => !allowedImports.some((allowed) => allowed.test(line)),
  );
}

interface LoadResult {
  resolved: string[];
  manifests: { url: string; id: string }[];
}

// Imports the manifests the way the host does before Nest starts: plain Node, workspace packages
// resolved to their source through the @northmes/source condition.
function loadInFreshProcess(paths: string[]): LoadResult {
  const urls = paths.map((path) => pathToFileURL(`${root}${path}`).href);
  const child = spawnSync(
    process.execPath,
    ['--conditions=@northmes/source', '--input-type=module', '--eval', loader, ...urls],
    { cwd: root, encoding: 'utf8' },
  );

  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout) as LoadResult;
}

describe('module manifests', () => {
  it('E02-S01 importing every in-repo manifest in a fresh process loads no @nestjs package', () => {
    const { resolved, manifests } = loadInFreshProcess(manifestPaths());

    expect(manifests).toContainEqual({
      url: pathToFileURL(`${root}modules/core/northmes.module.ts`).href,
      id: 'core',
    });
    expect(resolved.filter((url) => url.includes('/@nestjs/'))).toEqual([]);
  });

  it('E02-S01 every northmes.module.ts imports only defineModule and its own package.json', () => {
    const paths = manifestPaths();

    expect(paths).toContain('modules/core/northmes.module.ts');
    for (const path of paths) {
      expect(disallowedImports(readFileSync(`${root}${path}`, 'utf8')), path).toEqual([]);
    }
  });

  it('E02-S01 the import-line check reports an import that has no semicolon', () => {
    const body =
      "export default defineModule({ id: 'core', version: readFileSync('x', 'utf8'), northmes: '*' })\n";
    const oneWithout = `import { defineModule } from '@northmes/sdk';\nimport { readFileSync } from 'node:fs'\n${body}`;
    const noneWith = `import { defineModule } from '@northmes/sdk'\nimport { readFileSync } from 'node:fs'\n${body}`;

    expect(disallowedImports(oneWithout)).toEqual(["import { readFileSync } from 'node:fs'"]);
    expect(disallowedImports(noneWith)).toEqual([
      "import { defineModule } from '@northmes/sdk'",
      "import { readFileSync } from 'node:fs'",
    ]);
  });

  it('E02-S01 the import-line check reports a second import on the same line', () => {
    const source =
      "import { defineModule } from '@northmes/sdk'; import { readFileSync } from 'node:fs';\n" +
      "export default defineModule({ id: 'core', version: readFileSync('x', 'utf8'), northmes: '*' });\n";

    expect(disallowedImports(source)).toEqual(["import { readFileSync } from 'node:fs';"]);
  });
});
