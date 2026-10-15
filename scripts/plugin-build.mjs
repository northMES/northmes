// pnpm plugin:build <id>: builds a drop-in plugin (ADR 0037). Rolldown bundles src/manifest.ts and
// src/server.ts into dist/, keeps every HOST_PROVIDED package external, so one copy of each exists
// per process, and bundles everything else. The installable package (package.json, dist/ and
// migrations/) is then copied to plugins/<id>/, where the host loads it from.
//
// A plugin with screens also has src/web.tsx (or src/web.ts). Rolldown bundles it for the browser
// into web/entry.js and keeps the specifiers the web build shares through its import map external
// (HOST_PROVIDED_WEB, ADR 0075). A bare import of any other package left in the output fails the
// build, because the browser could not resolve it.
//
// The script imports isHostProvided from @northmes/sdk and isHostProvidedWeb from
// @northmes/web-sdk. Under plain node those resolve to the packages' build output, so the root
// script pnpm plugin:build builds both with turbo first.

import { existsSync, realpathSync } from 'node:fs';
import { cp, readdir, readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isHostProvided } from '@northmes/sdk';
import { HOST_PROVIDED_WEB, isHostProvidedWeb } from '@northmes/web-sdk/host-provided-web';
import { rolldown } from 'rolldown';
import { parseSync } from 'rolldown/utils';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

/** The parts of a plugin folder that make up the installable package. */
const packageParts = ['package.json', 'dist', 'web', 'migrations'];

/** A plugin that cannot be built, with the reason pnpm plugin:build prints. */
export class PluginBuildError extends Error {}

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
 * Bundles the web part `entry` into the plugin's web/ folder for the browser and returns its
 * files. A bare import that is not a shared web specifier fails the build.
 * @param {string} dir
 * @param {string} entry
 */
async function buildWebPart(dir, entry) {
  const web = join(dir, 'web');
  await rm(web, { recursive: true, force: true });
  const bundle = await rolldown({
    input: { entry },
    platform: 'browser',
    external: (id) => isHostProvidedWeb(id),
    transform: { jsx: { runtime: 'automatic' } },
    // An unresolved bare import stays an import, which the check below refuses by name.
    onLog: (level, log, defaultHandler) => {
      if (log.code !== 'UNRESOLVED_IMPORT') defaultHandler(level, log);
    },
  });
  let output;
  try {
    ({ output } = await bundle.write({ dir: web, format: 'esm', entryFileNames: '[name].js' }));
  } finally {
    await bundle.close();
  }
  for (const file of output) {
    if (file.type !== 'chunk') continue;
    const refused = packageImports(file.fileName, file.code).find((s) => !isHostProvidedWeb(s));
    if (refused !== undefined) {
      await rm(web, { recursive: true, force: true });
      throw new PluginBuildError(
        `web/${file.fileName} imports ${refused}, which the host does not share. Import only ${sharedList()}, or bundle the package`,
      );
    }
  }
  return output.map((file) => `web/${file.fileName}`);
}

/** The shared web specifiers as a sentence: a, b or c. */
function sharedList() {
  return `${HOST_PROVIDED_WEB.slice(0, -1).join(', ')} or ${HOST_PROVIDED_WEB.at(-1)}`;
}

/** The plugin's web part, src/web.tsx or src/web.ts, or undefined when it has no screens. */
function webEntryOf(dir) {
  return ['src/web.tsx', 'src/web.ts'].map((file) => join(dir, file)).find(existsSync);
}

/**
 * Builds the plugin package in `dir` into its dist/ folder, and its web part into web/, and copies
 * the installable package to `outDir`, which it empties first.
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
  const webEntry = webEntryOf(dir);
  const webFiles = webEntry ? await buildWebPart(dir, webEntry) : [];
  await rm(outDir, { recursive: true, force: true });
  for (const part of packageParts) {
    if (existsSync(join(dir, part))) {
      await cp(join(dir, part), join(outDir, part), { recursive: true });
    }
  }
  return {
    files: [...output.map((file) => `dist/${file.fileName}`), ...webFiles].sort(),
    imports,
  };
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
  try {
    await buildPlugin(dir, outDir);
  } catch (error) {
    if (!(error instanceof PluginBuildError)) throw error;
    io.error(error.message);
    return 1;
  }
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
