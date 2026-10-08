// pnpm plugin:build <id>: builds a drop-in plugin (ADR 0037). Rolldown bundles src/manifest.ts and
// src/server.ts into dist/, keeps every HOST_PROVIDED package external, so one copy of each exists
// per process, and bundles everything else.
//
// The script imports HOST_PROVIDED from @northmes/sdk. Under plain node that resolves to the SDK's
// build output, so the SDK must be built first (pnpm build does it).

import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { isHostProvided } from '@northmes/sdk';
import { rolldown } from 'rolldown';
import { parseSync } from 'rolldown/utils';

/**
 * The package specifiers a built file imports, read from its code. Relative specifiers point at
 * the build's own files and are left out.
 * @param {string} fileName
 * @param {string} code
 */
function packageImports(fileName, code) {
  const { module } = parseSync(fileName, code);
  const specifiers = [
    ...module.staticImports.map((entry) => entry.moduleRequest.value),
    ...module.staticExports.flatMap((entry) =>
      entry.entries.flatMap((exported) => exported.moduleRequest?.value ?? []),
    ),
    // A dynamic import's request is an expression; only a string literal names a specifier.
    ...module.dynamicImports.flatMap(({ moduleRequest }) => {
      const request = code.slice(moduleRequest.start, moduleRequest.end);
      return /^(['"]).*\1$/.test(request) ? [request.slice(1, -1)] : [];
    }),
  ];
  return [...new Set(specifiers)].filter((specifier) => !specifier.startsWith('.'));
}

/**
 * Builds the plugin package in `dir` into its dist/ folder.
 * @param {string} dir
 * @param {string} _outDir
 * @returns {Promise<import('./plugin-build.d.mts').BuiltPlugin>}
 */
export async function buildPlugin(dir, _outDir) {
  const dist = join(dir, 'dist');
  await rm(dist, { recursive: true, force: true });
  const bundle = await rolldown({
    input: { manifest: join(dir, 'src/manifest.ts'), server: join(dir, 'src/server.ts') },
    platform: 'node',
    external: (id) => isHostProvided(id),
  });
  let output;
  try {
    ({ output } = await bundle.write({ dir: dist, format: 'esm', entryFileNames: '[name].js' }));
  } finally {
    await bundle.close();
  }
  /** @type {Record<string, string[]>} */
  const imports = {};
  for (const file of output) {
    if (file.type === 'chunk') {
      imports[`dist/${file.fileName}`] = packageImports(file.fileName, file.code);
    }
  }
  return { files: output.map((file) => `dist/${file.fileName}`).sort(), imports };
}
