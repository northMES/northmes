// SPDX-License-Identifier: AGPL-3.0-or-later
// Keeps each module's code behind its public api. A module's code lives in apps/<app>/src/modules/<id>,
// such as apps/web/src/modules/planning. A file there may import another module only through that
// module's public api: in apps/backend, its public-api.ts (ADR 0070); in apps/web, its folder, its
// index file or its api file (api.ts or api/index.ts). An import of any other file of another module
// is a finding that names the importing file, its line and the import.
//
// Only relative imports can reach another module's files; a package name goes through the package's
// exports. Static, type-only and dynamic imports, re-exports and require calls all count.
//
// test/meta/module-boundaries.test.ts runs the scan over the files `git ls-files` lists, so pnpm
// check fails on a finding.

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ path: string, line: number, imported: string }} Finding
 */

/** TypeScript and JavaScript sources, the files the TypeScript parser reads. */
const sourceExtension = /\.[cm]?[jt]sx?$/;

/** A path in a module's folder: the folder, then the path below it, if any. */
const modulePath = /^(apps\/[^/]+\/src\/modules\/[^/]+)(?:\/(.*))?$/;

/** The paths below a backend module's folder that make up its public api. */
const backendPublicApi = /^public-api(?:\.[cm]?[jt]sx?)?$/;

/** The paths below a web module's folder that make up its public api. */
const webPublicApi = /^(?:(?:index|api|api\/index)(?:\.[cm]?[jt]sx?)?)?$/;

/**
 * Whether a path below the folder of a module is part of that module's public api.
 * @param {string} folder The module's folder, such as apps/backend/src/modules/core.
 * @param {string} below The path below it, empty for the folder itself.
 */
function isPublicApi(folder, below) {
  const publicApi = folder.startsWith('apps/backend/') ? backendPublicApi : webPublicApi;
  return publicApi.test(below);
}

/**
 * The findings of files, each a file's path relative to the repository root and its text.
 * @param {readonly SourceFile[]} files
 * @returns {Finding[]}
 */
export function scan(files) {
  /** @type {Finding[]} */
  const findings = [];
  for (const { path, text } of files) {
    const own = modulePath.exec(path)?.[1];
    if (!sourceExtension.test(path) || own === undefined) continue;
    const lineStarts = ts.computeLineStarts(text);
    for (const { fileName, pos } of ts.preProcessFile(text, true, true).importedFiles) {
      if (!/^\.\.?(\/|$)/.test(fileName)) continue;
      const target = modulePath.exec(posix.join(posix.dirname(path), fileName));
      if (target === null || target[1] === own || isPublicApi(target[1], target[2] ?? '')) {
        continue;
      }
      const line = ts.computeLineAndCharacterOfPosition(lineStarts, pos).line + 1;
      findings.push({ path, line, imported: fileName });
    }
  }
  return findings;
}

/**
 * Reads the source files in a module's folder among the files `git ls-files` lists in the
 * repository that holds `cwd`, with paths relative to its top level. git runs without the GIT_*
 * variables of a hook, so it reads the repository that holds `cwd`.
 * @param {string} cwd
 * @returns {SourceFile[]}
 */
export function trackedModuleFiles(cwd) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  /** @param {string[]} args */
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env, maxBuffer: 64 << 20 });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
    }
    return result.stdout;
  };
  const top = git('rev-parse', '--show-toplevel').trim();
  return git('-C', top, 'ls-files', '-z', 'apps')
    .split('\0')
    .filter(
      (path) =>
        sourceExtension.test(path) &&
        modulePath.test(path) &&
        statSync(join(top, path), { throwIfNoEntry: false })?.isFile(),
    )
    .map((path) => ({ path, text: readFileSync(join(top, path), 'utf8') }));
}
