// pnpm plugin:build <id>: builds a drop-in plugin (ADR 0037). Rolldown bundles src/manifest.ts and
// src/server.ts into dist/, keeps every HOST_PROVIDED package external, so one copy of each exists
// per process, and bundles everything else. The installable package (package.json, dist/ and
// migrations/) is then copied to plugins/<id>/, where the host loads it from.
//
// The script imports isHostProvided from @northmes/sdk. Under plain node that resolves to the
// SDK's build output, so the root script pnpm plugin:build builds the SDK with turbo first.

import { existsSync, realpathSync } from 'node:fs';
import { cp, readdir, readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isHostProvided } from '@northmes/sdk';
import { rolldown } from 'rolldown';
import { parseSync } from 'rolldown/utils';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

/** The parts of a plugin folder that make up the installable package. */
const packageParts = ['package.json', 'dist', 'migrations'];

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
 * Builds the plugin package in `dir` into its dist/ folder and copies the installable package to
 * `outDir`, which it empties first.
 * @param {string} dir
 * @param {string} outDir
 * @returns {Promise<import('./plugin-build.d.mts').BuiltPlugin>}
 */
export async function buildPlugin(dir, outDir) {
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
  await rm(outDir, { recursive: true, force: true });
  for (const part of packageParts) {
    if (existsSync(join(dir, part))) {
      await cp(join(dir, part), join(outDir, part), { recursive: true });
    }
  }
  return { files: output.map((file) => `dist/${file.fileName}`).sort(), imports };
}

/**
 * The folder under examples/ whose package name, without its scope, is the plugin id.
 * @param {string} root
 * @param {string} id
 */
async function findPlugin(root, id) {
  const examples = join(root, 'examples');
  const folders = existsSync(examples) ? await readdir(examples, { withFileTypes: true }) : [];
  for (const folder of folders.filter((entry) => entry.isDirectory())) {
    const packageJson = join(examples, folder.name, 'package.json');
    if (!existsSync(packageJson)) continue;
    const { name } = JSON.parse(await readFile(packageJson, 'utf8'));
    if (typeof name === 'string' && name.split('/').at(-1) === id) {
      return join(examples, folder.name);
    }
  }
  return undefined;
}

/**
 * pnpm plugin:build <id>
 * @param {readonly string[]} argv
 * @param {import('./plugin-build.d.mts').MainIo} io
 */
export async function main(argv, io) {
  if (argv.length !== 1) {
    io.error('Usage: pnpm plugin:build <id>');
    return 1;
  }
  const [id] = argv;
  const dir = await findPlugin(io.root, id);
  if (dir === undefined) {
    io.error(`No package under examples/ is named ${id}`);
    return 1;
  }
  const outDir = join(io.root, 'plugins', id);
  await buildPlugin(dir, outDir);
  io.log(`Built ${relative(io.root, dir)} into ${relative(io.root, outDir)}`);
  return 0;
}

function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    // Under --eval, argv[1] is a positional argument, not a script path.
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = await main(process.argv.slice(2), {
    log: console.log,
    error: console.error,
    root: repositoryRoot,
  });
}
