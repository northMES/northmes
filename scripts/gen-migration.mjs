// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

const tableTemplate = readFileSync(new URL('./templates/table.sql', import.meta.url), 'utf8');
const registerTemplate = readFileSync(new URL('./templates/register.sql', import.meta.url), 'utf8');

// Postgres cuts a name at 63 bytes, and the register template's longest suffix is
// _translations_check (19), so a longer slug would cut _code_excl, which toDomainError reads.
const registerSlugLength = 63 - '_translations_check'.length;

const usage = 'Usage: pnpm gen:migration [--register] <module> <slug>';

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
 * Renders the table template, or with register the register template (ADR 0022), for a new table
 * in a module's schema, and the path of its migration file from the repository root. Throws when
 * the module is not a module id, the slug is not a lower-case SQL name, or a register's slug is
 * longer than its constraint names allow.
 * @param {{ module: string, slug: string, now: Date, register?: boolean }} options
 */
export function render({ module, slug, now, register = false }) {
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
  if (register && slug.length > registerSlugLength) {
    throw new Error(
      `Invalid slug "${slug}": a register's slug names its constraints, so use at most ${registerSlugLength} characters`,
    );
  }
  const schema = module.replaceAll('-', '_');
  const template = register ? registerTemplate : tableTemplate;
  const sql = template.replaceAll('{{schema}}', schema).replaceAll('{{table}}', slug);
  return {
    path: `apps/backend/src/modules/${module}/migrations/${timestamp(now)}_${slug}.sql`,
    sql,
  };
}

/**
 * pnpm gen:migration [--register] <module> <slug>: writes the rendered file under io.root and
 * returns the exit code.
 * @param {readonly string[]} argv
 * @param {{ log: (line: string) => void, error: (line: string) => void, root: string, now: () => Date }} io
 */
export async function main(argv, io) {
  const register = argv[0] === '--register';
  const args = register ? argv.slice(1) : argv;
  if (args.length !== 2 || args.some((arg) => arg.startsWith('--'))) {
    io.error(usage);
    return 1;
  }
  const [module, slug] = args;
  const moduleFolder = `apps/backend/src/modules/${module}`;
  if (!existsSync(join(io.root, moduleFolder))) {
    io.error(`No module folder ${moduleFolder}`);
    return 1;
  }
  let path;
  let sql;
  try {
    ({ path, sql } = render({ module, slug, now: io.now(), register }));
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
