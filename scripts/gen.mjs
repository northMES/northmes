// pnpm gen writes the generated files that the repository commits; pnpm gen --check fails when one
// of them differs from what pnpm gen would write (plan 06). Each stage generates into one temporary
// directory, at the files' paths relative to the repository root, so a later stage reads what an
// earlier one wrote and a failing stage leaves the repository as it was. Then pnpm gen copies every
// changed file into the repository and removes each file a stage owns but no longer writes, and
// pnpm gen --check compares instead.

import { spawnSync } from 'node:child_process';
import { globSync, realpathSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * @typedef {object} Stage
 * @property {string} name What pnpm gen prints for the stage.
 * @property {readonly string[]} outputs Globs, relative to the repository root, of the files the
 *   stage owns. A file that matches one and that the stage no longer writes is stale.
 * @property {(outDir: string) => Promise<void>} generate Writes every file the stage owns under
 *   outDir, at its path relative to the repository root.
 */

/** Writes text to a file under outDir, creating its folders. */
async function writeUnder(outDir, path, text) {
  const file = join(outDir, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
}

/**
 * schema/api.graphql: the backend's one schema (ADR 0070). The stage builds the backend through
 * turbo, which reuses its cache when nothing changed, and prints the schema of its build.
 * @type {Stage}
 */
const schemaStage = {
  name: 'schema',
  outputs: ['schema/api.graphql'],
  async generate(outDir) {
    const build = spawnSync(
      'pnpm',
      ['exec', 'turbo', 'run', 'build', '--filter=@northmes/backend', '--output-logs=errors-only'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );
    if (build.status !== 0) {
      throw new Error(`the backend did not build:\n${build.stdout}${build.stderr}`);
    }
    const sdlModule = join(repositoryRoot, 'apps/backend/dist/graphql/schema-sdl.js');
    const { schemaSdl } = await import(pathToFileURL(sdlModule).href);
    await writeUnder(outDir, 'schema/api.graphql', await schemaSdl());
  },
};

/**
 * The typed documents of the web: one <operation>.graphql.gen.ts next to each
 * <operation>.graphql.ts in apps/web/src, from the schema the schema stage wrote.
 * @type {Stage}
 */
const webDocumentsStage = {
  name: 'web documents',
  outputs: ['apps/web/src/**/*.graphql.gen.ts'],
  async generate(outDir) {
    const codegen = join(repositoryRoot, 'apps/web/codegen.ts');
    const { generateDocuments } = await import(pathToFileURL(codegen).href);
    const files = await generateDocuments(join(outDir, 'schema/api.graphql'));
    for (const { path, content } of files) {
      await writeUnder(outDir, join('apps/web', path), content);
    }
  },
};

/** @type {readonly Stage[]} */
export const stages = Object.freeze([schemaStage, webDocumentsStage]);

/** The files under dir that match the globs, as sorted paths relative to dir. */
function filesMatching(dir, globs) {
  if (globs.length === 0) return [];
  const paths = globSync(globs, { cwd: dir, exclude: ['**/node_modules/**'] });
  return [...new Set(paths)].sort();
}

/** The text of a file, or undefined when there is none. */
async function textOf(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

/**
 * @typedef {{ path: string, kind: 'changed' | 'missing' | 'stale' }} Drift
 */

/**
 * How the repository root differs from outDir in the files the stages own, sorted by path.
 * @returns {Promise<Drift[]>}
 */
async function driftOf(stageList, outDir, root) {
  const globs = stageList.flatMap((stage) => stage.outputs);
  const generated = new Set(filesMatching(outDir, globs));
  const paths = [...new Set([...generated, ...filesMatching(root, globs)])].sort();
  /** @type {Drift[]} */
  const drift = [];
  for (const path of paths) {
    const committed = await textOf(join(root, path));
    if (!generated.has(path)) {
      drift.push({ path, kind: 'stale' });
    } else if (committed === undefined) {
      drift.push({ path, kind: 'missing' });
    } else if (committed !== (await readFile(join(outDir, path), 'utf8'))) {
      drift.push({ path, kind: 'changed' });
    }
  }
  return drift;
}

/** The line of --check's message for one drifted file. */
const checkLine = {
  changed: (path) => `- ${path} is out of date`,
  missing: (path) => `- ${path} is missing`,
  stale: (path) => `- ${path} is stale: no stage writes it`,
};

/**
 * Runs the stages into a temporary directory, then writes their files into io.root, or with
 * options.check compares them with io.root. Returns the exit code.
 */
export async function run(stageList, options, io) {
  const names = stageList.map((stage) => stage.name).join(', ');
  io.log(`stages: ${names || 'none'}`);
  const outDir = await mkdtemp(join(tmpdir(), 'gen-'));
  try {
    for (const stage of stageList) {
      await stage.generate(outDir);
    }
    const drift = await driftOf(stageList, outDir, io.root);
    if (options.check) {
      if (drift.length === 0) return 0;
      const count =
        drift.length === 1 ? '1 generated file differs' : `${drift.length} generated files differ`;
      io.error(
        [
          `gen --check: ${count} from what pnpm gen writes`,
          ...drift.map(({ path, kind }) => checkLine[kind](path)),
          'Run pnpm gen and commit the result.',
        ].join('\n'),
      );
      return 1;
    }
    for (const { path, kind } of drift) {
      if (kind === 'stale') {
        await rm(join(io.root, path));
        io.log(`removed ${path}`);
      } else {
        await mkdir(dirname(join(io.root, path)), { recursive: true });
        await cp(join(outDir, path), join(io.root, path));
        io.log(`wrote ${path}`);
      }
    }
    return 0;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    // Under --eval, argv[1] is a positional argument, not a script path.
    return false;
  }
}

export async function main(argv, io, stageList = stages) {
  return run(stageList, { check: argv.includes('--check') }, io);
}

if (isEntryPoint()) {
  process.exitCode = await main(process.argv.slice(2), {
    log: console.log,
    error: console.error,
    root: repositoryRoot,
  });
}
