import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

const tableTemplate = readFileSync(new URL('./templates/table.sql', import.meta.url), 'utf8');

/**
 * The UTC yyyymmddHHMMss timestamp that starts a migration file name (ADR 0006).
 * @param {Date} now
 */
function timestamp(now) {
  return now.toISOString().slice(0, 'yyyy-mm-ddTHH:MM:ss'.length).replace(/\D/g, '');
}

// The module id rule, MODULE_ID in packages/sdk/src/module-names.ts. This script runs under plain
// node, where @northmes/sdk resolves to its build output, so it keeps its own copy.
const modulePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// A lower-case SQL name that needs no quotes, which the slug is because it names the table.
const slugPattern = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

/**
 * Renders the table template for a new table in a module's schema, and the path of its migration
 * file from the repository root. Throws when the module is not a module id or the slug is not a
 * lower-case SQL name.
 * @param {{ module: string, slug: string, now: Date }} options
 */
export function render({ module, slug, now }) {
  if (!modulePattern.test(module)) {
    throw new Error(
      `Invalid module "${module}": the module id names the folder and the schema, so use lower-case letters, digits and single hyphens, starting with a letter`,
    );
  }
  if (!slugPattern.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}": the slug names the table, so use lower-case letters, digits and single underscores, starting with a letter`,
    );
  }
  const schema = module.replaceAll('-', '_');
  const sql = tableTemplate.replaceAll('{{schema}}', schema).replaceAll('{{table}}', slug);
  return { path: `modules/${module}/migrations/${timestamp(now)}_${slug}.sql`, sql };
}

/**
 * pnpm gen:migration <module> <slug>: writes the rendered file under io.root and returns the exit
 * code.
 * @param {readonly string[]} argv
 * @param {{ log: (line: string) => void, error: (line: string) => void, root: string, now: () => Date }} io
 */
export async function main(argv, io) {
  if (argv.length !== 2) {
    io.error('Usage: pnpm gen:migration <module> <slug>');
    return 1;
  }
  const [module, slug] = argv;
  const moduleFolder = `modules/${module}`;
  if (!existsSync(join(io.root, moduleFolder))) {
    io.error(`No module folder ${moduleFolder}`);
    return 1;
  }
  let path;
  let sql;
  try {
    ({ path, sql } = render({ module, slug, now: io.now() }));
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const file = join(io.root, path);
  await mkdir(dirname(file), { recursive: true });
  // wx refuses to replace a file that exists.
  await writeFile(file, sql, { flag: 'wx' });
  io.log(`Wrote ${path}`);
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
    now: () => new Date(),
  });
}
