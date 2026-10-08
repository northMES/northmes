// SPDX-License-Identifier: AGPL-3.0-or-later
// Keeps AGPL code out of the MIT packages (docs/adr/0056-mit-sdk-packages-the-extension-exception-
// and-the-trademark-policy.md). Every source and test file of a workspace package whose license is
// MIT is read for its imports, and an import of a workspace package whose license is AGPL is a
// finding that names the importing file, its line and the imported package. An import names a
// package by its name, with or without a subpath, or by a relative path that lands in the
// package's folder. Static, type-only and dynamic imports, re-exports and require calls all count.
// A path built with new URL(..., import.meta.url) is not an import, so a test can still spawn
// AGPL code by path.

import { posix } from 'node:path';
import ts from 'typescript';

/**
 * @typedef {{ name?: string, license?: string }} Manifest
 * @typedef {{ path: string, manifest: Manifest }} WorkspacePackage
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ kind: 'import', path: string, line: number, imported: string }} Finding
 */

/** TypeScript and JavaScript sources, the files the TypeScript parser reads. */
const sourceExtension = /\.[cm]?[jt]sx?$/;

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
 * The workspace package whose folder is or holds a path, the deepest one when packages nest.
 * @param {readonly { dir: string, manifest: Manifest }[]} packages
 * @param {string} path
 */
function owner(packages, path) {
  let found;
  for (const candidate of packages) {
    const holds = path === candidate.dir || path.startsWith(`${candidate.dir}/`);
    if (holds && candidate.dir.length > (found?.dir.length ?? -1)) {
      found = candidate;
    }
  }
  return found;
}

/**
 * Finds imports of AGPL workspace packages in the files of MIT packages.
 * @param {readonly WorkspacePackage[]} packages Each package's package.json path and manifest.
 * @param {readonly SourceFile[]} files Repository-relative paths with forward slashes.
 * @returns {Finding[]}
 */
export function scan(packages, files) {
  const workspace = packages.map(({ path, manifest }) => ({ dir: posix.dirname(path), manifest }));
  const byName = new Map(workspace.map((entry) => [entry.manifest.name, entry]));
  /** @type {Finding[]} */
  const findings = [];

  for (const { path, text } of files) {
    if (!sourceExtension.test(path) || owner(workspace, path)?.manifest.license !== 'MIT') {
      continue;
    }
    const lineStarts = ts.computeLineStarts(text);
    for (const { fileName, pos } of ts.preProcessFile(text, true, true).importedFiles) {
      const imported = /^\.\.?(\/|$)/.test(fileName)
        ? owner(workspace, posix.join(posix.dirname(path), fileName))
        : byName.get(packageName(fileName));
      if (imported && isAgpl(imported.manifest)) {
        const line = ts.computeLineAndCharacterOfPosition(lineStarts, pos).line + 1;
        findings.push({ kind: 'import', path, line, imported: imported.manifest.name });
      }
    }
  }

  return findings;
}
