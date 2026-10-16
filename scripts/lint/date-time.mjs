// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Keeps date and time code on Luxon (docs/adr/0082-luxon-for-dates-and-times-with-utc-instants-iso-
// strings-at-the-boundaries-and-the-clamp-resolver.md). The check parses the TypeScript and
// JavaScript sources under apps, packages, modules, examples, scripts, test and e2e with the
// TypeScript parser and reports, with the file and the line:
//
// - `new Date`, a `Date()` call and every static `Date` method other than `Date.now`, such as
//   `Date.parse` and `Date.UTC`;
// - the `Temporal` global, in a value, a type or a property such as `globalThis.Temporal`;
// - an import of another date library: temporal-polyfill, @js-temporal/polyfill, date-fns,
//   date-fns-tz, the @date-fns scope, dayjs, moment and moment-timezone. Static, type-only and
//   dynamic imports, re-exports and require calls all count.
//
// `Date.now()` passes: it is the clock source the ADR keeps, and a `Date` that a library hands out
// is converted with `DateTime.fromJSDate`, which the check does not see. Comments and strings are
// not code, so they pass.
//
// scripts/lint/date-time.allow.json lists the exceptions as entries of the form
// { "path": "<file>", "use": "<use as the finding names it>", "reason": "<why>" }. An entry without
// a reason fails the check, and so does an entry that matches no use any more.
// test/meta/date-time.test.ts runs the check over the files `git ls-files` lists, and pnpm check
// runs that test.

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} RepositoryFile
 * @typedef {{ path: string, use: string, reason?: string }} AllowlistEntry
 * @typedef {{ path: string, line: number, use: string }} Finding
 */

/**
 * The folders the rule covers. Paths are repository-relative with forward slashes, as
 * `git ls-files` prints them.
 */
const scannedFolders = /^(apps|packages|modules|examples|scripts|test|e2e)\//;

/** TypeScript and JavaScript sources, the files the TypeScript parser reads. */
const sourceExtension = /\.[cm]?[jt]sx?$/;

/** Date libraries other than Luxon, by package name. */
const otherDateLibraries = new Set([
  'temporal-polyfill',
  '@js-temporal/polyfill',
  'date-fns',
  'date-fns-tz',
  'dayjs',
  'moment',
  'moment-timezone',
]);

/** @param {string} path */
function isScanned(path) {
  return sourceExtension.test(path) && scannedFolders.test(path);
}

/**
 * The package a bare import specifier names: `@scope/name` or `name`, without a subpath.
 * @param {string} specifier
 */
function packageName(specifier) {
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/** @param {string} name */
function isOtherDateLibrary(name) {
  return otherDateLibraries.has(name) || name.startsWith('@date-fns/');
}

/**
 * The module a node imports when it is an import or export declaration, a dynamic import or a
 * require call with a string literal.
 * @param {ts.Node} node
 * @returns {string | undefined}
 */
function importedModule(node) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (ts.isCallExpression(node)) {
    const [first] = node.arguments;
    const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
    if ((isImport || isRequire) && first && ts.isStringLiteralLike(first)) {
      return first.text;
    }
  }
  return undefined;
}

/** @param {ts.Node} node */
function isDate(node) {
  return ts.isIdentifier(node) && node.text === 'Date';
}

/**
 * The use a node makes of `Date`, `Temporal` or another date library, as a finding names it.
 * @param {ts.Node} node
 * @returns {string | undefined}
 */
function useOf(node) {
  if (ts.isNewExpression(node) && isDate(node.expression)) {
    return 'new Date';
  }
  if (ts.isCallExpression(node) && isDate(node.expression)) {
    return 'Date()';
  }
  if (ts.isPropertyAccessExpression(node) && isDate(node.expression) && node.name.text !== 'now') {
    return `Date.${node.name.text}`;
  }
  if (ts.isIdentifier(node) && node.text === 'Temporal') {
    return 'Temporal';
  }
  const imported = importedModule(node);
  if (imported !== undefined && isOtherDateLibrary(packageName(imported))) {
    return `import ${packageName(imported)}`;
  }
  return undefined;
}

/**
 * Throws when an allowlist entry gives no reason.
 * @param {readonly AllowlistEntry[]} allowlist
 */
function checkReasons(allowlist) {
  for (const entry of allowlist) {
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(`Date and time allowlist entry ${entry.path} ${entry.use} has no reason`);
    }
  }
}

/**
 * Every use of `Date`, `Temporal` or another date library in the scanned files, in source order.
 * @param {readonly RepositoryFile[]} files
 * @returns {Finding[]}
 */
function uses(files) {
  /** @type {Finding[]} */
  const found = [];
  for (const { path, text } of files.filter((file) => isScanned(file.path))) {
    const kind = /\.[cm]?[jt]sx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
    const visit = (node) => {
      const use = useOf(node);
      if (use !== undefined) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        found.push({ path, line, use });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

/**
 * Finds the uses of `Date`, `Temporal` and other date libraries that the allowlist does not name.
 * Throws when an allowlist entry gives no reason.
 * @param {readonly RepositoryFile[]} files
 * @param {readonly AllowlistEntry[]} allowlist
 * @returns {Finding[]}
 */
export function scan(files, allowlist) {
  checkReasons(allowlist);
  return uses(files).filter(
    (finding) =>
      !allowlist.some((entry) => entry.path === finding.path && entry.use === finding.use),
  );
}

/**
 * The allowlist entries that match no use in the files, so the allowlist shrinks as code moves to
 * Luxon.
 * @param {readonly RepositoryFile[]} files
 * @param {readonly AllowlistEntry[]} allowlist
 * @returns {AllowlistEntry[]}
 */
export function staleEntries(files, allowlist) {
  const found = uses(files);
  return allowlist.filter(
    (entry) => !found.some((finding) => finding.path === entry.path && finding.use === entry.use),
  );
}

/**
 * Reads the files the scan covers among those `git ls-files` lists in the repository that holds
 * `cwd`, with paths relative to its top level. Untracked files and tracked files missing from the
 * working tree are not read. git runs without the GIT_* variables of a hook, so it reads the
 * repository that holds `cwd`.
 * @param {string} cwd
 * @returns {RepositoryFile[]}
 */
export function trackedFiles(cwd) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  const git = (...args) => {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
    }
    return result.stdout;
  };

  const top = git('rev-parse', '--show-toplevel').trim();
  return git('-C', top, 'ls-files', '-z')
    .split('\0')
    .filter(
      (path) => isScanned(path) && statSync(join(top, path), { throwIfNoEntry: false })?.isFile(),
    )
    .map((path) => ({ path, text: readFileSync(join(top, path), 'utf8') }));
}
