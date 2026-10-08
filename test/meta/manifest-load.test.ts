// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
});
