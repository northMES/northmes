// SPDX-License-Identifier: AGPL-3.0-or-later
// Keeps AGPL code out of the MIT packages (docs/adr/0056-mit-sdk-packages-the-extension-exception-
// and-the-trademark-policy.md). Every source and test file of a workspace package whose license is
// MIT, and of every plugin under examples/, is read for its imports. An import of a workspace
// package whose license is AGPL is a finding that names the importing file, its line and the
// imported package. A modules/*/contracts package whose license is not MIT is a finding as well.
//
// An import names a package by its name, with or without a subpath, or by a relative path that
// lands in the package's folder. Static, type-only and dynamic imports, re-exports and require
// calls all count. A path built with new URL(..., import.meta.url) is not an import, so a test can
// still spawn AGPL code by path.
//
// The root package is AGPL and its folder holds every path that no workspace package holds, so an
// import of scripts/ or of the package by its name counts as well.
//
// test/meta/mit-imports.test.ts runs the scan over the root package, the workspace packages that
// pnpm-workspace.yaml names and the files `git ls-files` lists, so pnpm check fails on a finding.

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';

/**
 * @typedef {{ name?: string, license?: string }} Manifest
 * @typedef {{ path: string, manifest: Manifest }} WorkspacePackage
 * @typedef {WorkspacePackage & { dir: string }} PackageFolder
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ kind: 'import', path: string, line: number, imported: string }
 *   | { kind: 'license', path: string, license: string | undefined }} Finding
 */

/** TypeScript and JavaScript sources, the files the TypeScript parser reads. */
const sourceExtension = /\.[cm]?[jt]sx?$/;

/** A module's contracts package, which is MIT (ADR 0003 and ADR 0056). */
const contractsPackage = /^modules\/[^/]+\/contracts$/;

/** Plugins under examples/ show plugin authors the rule, whatever their own license. */
const examplePlugin = /^examples\/[^/]+$/;

/**
 * Each package with the folder its package.json sits in.
 * @param {readonly WorkspacePackage[]} packages
 * @returns {PackageFolder[]}
 */
function folders(packages) {
  return packages.map((entry) => ({ ...entry, dir: posix.dirname(entry.path) }));
}

/**
 * Whether the rule covers a package's files: an MIT package or an examples plugin.
 * @param {PackageFolder} entry
 */
function isScanned(entry) {
  return entry.manifest.license === 'MIT' || examplePlugin.test(entry.dir);
}

/** @param {Manifest} manifest */
function isAgpl(manifest) {
  return /\bAGPL-/.test(manifest.license ?? '');
}

/**
 * The package a bare import specifier names: `@scope/name` or `name`, without a subpath.
 * @param {string} specifier
 */
function packageName(specifier) {
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/**
 * Whether a package folder is or holds a path. The root package's folder `.` holds every path in
 * the repository.
 * @param {string} dir
 * @param {string} path
 */
function holds(dir, path) {
  if (dir === '.') {
    return path !== '..' && !path.startsWith('../');
  }
  return path === dir || path.startsWith(`${dir}/`);
}

/**
 * How deep a package folder sits, so the deepest package that holds a path owns it. The root
 * package's folder `.` counts as 0.
 * @param {string} dir
 */
function depth(dir) {
  return dir === '.' ? 0 : dir.length;
}

/**
 * The workspace package whose folder is or holds a path, the deepest one when packages nest.
 * @param {readonly PackageFolder[]} packages
 * @param {string} path
 */
function owner(packages, path) {
  let found;
  for (const candidate of packages) {
    if (holds(candidate.dir, path) && depth(candidate.dir) > (found ? depth(found.dir) : -1)) {
      found = candidate;
    }
  }
  return found;
}

/**
 * Finds contracts packages that are not MIT, then imports of AGPL workspace packages in the files
 * of MIT packages and examples plugins. An import of the file's own package is not a finding.
 * @param {readonly WorkspacePackage[]} packages Each package's package.json path and manifest.
 * @param {readonly SourceFile[]} files Repository-relative paths with forward slashes.
 * @returns {Finding[]}
 */
export function scan(packages, files) {
  const workspace = folders(packages);
  const byName = new Map(workspace.map((entry) => [entry.manifest.name, entry]));
  /** @type {Finding[]} */
  const findings = workspace
    .filter(({ dir, manifest }) => contractsPackage.test(dir) && manifest.license !== 'MIT')
    .map(({ path, manifest }) => ({ kind: 'license', path, license: manifest.license }));

  for (const { path, text } of files) {
    const own = owner(workspace, path);
    if (!sourceExtension.test(path) || !own || !isScanned(own)) {
      continue;
    }
    const lineStarts = ts.computeLineStarts(text);
    for (const { fileName, pos } of ts.preProcessFile(text, true, true).importedFiles) {
      const imported = /^\.\.?(\/|$)/.test(fileName)
        ? owner(workspace, posix.join(posix.dirname(path), fileName))
        : byName.get(packageName(fileName));
      if (imported && imported !== own && isAgpl(imported.manifest)) {
        const line = ts.computeLineAndCharacterOfPosition(lineStarts, pos).line + 1;
        findings.push({ kind: 'import', path, line, imported: imported.manifest.name });
      }
    }
  }

  return findings;
}

/**
 * Reads the root package, the workspace packages that pnpm-workspace.yaml names and the source
 * files of the packages the rule covers, among the files `git ls-files` lists in the repository
 * that holds `cwd`, with paths relative to its top level. Untracked files and tracked files missing
 * from the working tree are not read. git runs without the GIT_* variables of a hook, so it reads the repository that holds
 * `cwd`.
 * @param {string} cwd
 * @returns {{ packages: WorkspacePackage[], files: SourceFile[] }}
 */
export function trackedWorkspace(cwd) {
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
  const read = (path) => readFileSync(join(top, path), 'utf8');
  const exists = (path) => statSync(join(top, path), { throwIfNoEntry: false })?.isFile();
  const globs = parse(read('pnpm-workspace.yaml'))?.packages ?? [];
  const tracked = git('-C', top, 'ls-files', '-z').split('\0');

  const packages = tracked
    .filter(
      (path) =>
        (path === 'package.json' ||
          (posix.basename(path) === 'package.json' &&
            globs.some((glob) => posix.matchesGlob(posix.dirname(path), glob)))) &&
        exists(path),
    )
    .map((path) => ({ path, manifest: JSON.parse(read(path)) }));
  const workspace = folders(packages);
  const files = tracked
    .filter((path) => {
      const own = sourceExtension.test(path) && owner(workspace, path);
      return own && isScanned(own) && exists(path);
    })
    .map((path) => ({ path, text: read(path) }));

  return { packages, files };
}
