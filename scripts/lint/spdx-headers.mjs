// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Checks the SPDX header of every hand-written source file (docs/adr/0039-license-agpl-3-0-or-later-
// core-and-a-contributor-license-agreement.md and docs/adr/0056-mit-sdk-packages-the-extension-
// exception-and-the-trademark-policy.md). A .ts, .tsx, .mts, .mjs, .js, .cjs, .sql, .sh or .css file
// starts with two comment lines, after a shebang line when it has one:
//
//   // SPDX-License-Identifier: <the license field of the package that holds the file>
//   // SPDX-FileCopyrightText: <year> <holder>
//
// SQL files use --, shell files #, and CSS files /* */. The package that holds a file is the
// deepest workspace package whose folder holds it; the root package holds every other path.
//
// These files are not hand-written, or must keep their bytes, and are skipped:
// - generated files: *.gen.* and every file a stage of scripts/gen.mjs owns;
// - SQL migrations and the migration template: a migration's first line is its expand or contract
//   marker, and an applied migration must not change, because the runner records its checksum;
// - the shadcn primitives in apps/web/src/ui/primitives and the hook it writes to ui/lib, which
//   the shadcn CLI generates (ADR 0020);
// - test fixtures that stand in for built web output, served and compared byte for byte;
// - the third-party agent skills that skills-lock.json pins, which keep their source's license;
// - docs/sources (copied third-party sources) and docs/design (exports of the design project).
//
// test/meta/spdx-headers.test.ts runs the check over the files `git ls-files` lists, so pnpm check
// fails on a finding.

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parse } from 'yaml';
import { stages } from '../gen.mjs';

/**
 * @typedef {{ name?: string, license?: string }} Manifest
 * @typedef {{ path: string, manifest: Manifest }} WorkspacePackage
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ generated: readonly string[], thirdPartySkills: readonly string[] }} Skipped
 * @typedef {{ kind: 'license', path: string, expected: string, found: string | undefined }
 *   | { kind: 'copyright', path: string }} Finding
 */

/** The file kinds that carry a header. */
export const sourceExtension = /\.(?:[cm]?[jt]sx?|sql|sh|css)$/;

/** Paths that are never hand-written source, whatever the generator globs say. */
const skippedPaths = [
  /(?:^|\/)node_modules\//,
  /(?:^|\/)dist\//,
  /^docs\/sources\//,
  /^docs\/design\//,
  /\.gen\.[^/]+$/,
  /(?:^|\/)migrations\/(?:[^/]+\/)*[^/]+\.sql$/,
  // The migration templates and the files gen:migration renders from them, which are migrations.
  /^scripts\/templates\/[^/]+\.sql$/,
  /^scripts\/fixtures\/gen-migration\/[^/]+\.sql$/,
  /^apps\/web\/src\/ui\/primitives\//,
  /^apps\/web\/src\/ui\/lib\/use-mobile\.ts$/,
  /^apps\/backend\/test\/fixtures\/web\//,
  /^apps\/backend\/test\/fixtures\/plugins\/[^/]+\/web\//,
];

const licenseLine =
  /^(?:\/\/|#|--|\/\*)\s*SPDX-License-Identifier:\s*(?<license>\S+?)\s*(?:\*\/)?\s*$/;
const copyrightLine = /^(?:\/\/|#|--|\/\*)\s*SPDX-FileCopyrightText:\s*\S.*?\s*(?:\*\/)?\s*$/;

/**
 * Whether the check skips a path.
 * @param {string} path
 * @param {Skipped} skipped
 */
export function isSkipped(path, { generated, thirdPartySkills }) {
  return (
    skippedPaths.some((pattern) => pattern.test(path)) ||
    generated.some((glob) => posix.matchesGlob(path, glob)) ||
    thirdPartySkills.some((skill) => path.startsWith(`.claude/skills/${skill}/`))
  );
}

/**
 * The license of the deepest package whose folder holds a path.
 * @param {readonly WorkspacePackage[]} packages
 * @param {string} path
 */
function licenseOf(packages, path) {
  let found;
  let foundDepth = -1;
  for (const { path: manifestPath, manifest } of packages) {
    const dir = posix.dirname(manifestPath);
    const holds = dir === '.' || path.startsWith(`${dir}/`);
    const depth = dir === '.' ? 0 : dir.length;
    if (holds && depth > foundDepth) {
      found = manifest.license;
      foundDepth = depth;
    }
  }
  return found;
}

/**
 * Finds source files whose first lines, after a shebang, are not an SPDX license identifier equal
 * to their package's license and an SPDX copyright line.
 * @param {readonly WorkspacePackage[]} packages Each package's package.json path and manifest.
 * @param {readonly SourceFile[]} files Repository-relative paths with forward slashes.
 * @param {Skipped} skipped
 * @returns {Finding[]}
 */
export function scan(packages, files, skipped) {
  /** @type {Finding[]} */
  const findings = [];
  for (const { path, text } of files) {
    if (!sourceExtension.test(path) || isSkipped(path, skipped)) {
      continue;
    }
    const lines = text.split('\n');
    const header = lines[0]?.startsWith('#!') ? lines.slice(1, 3) : lines.slice(0, 2);
    const expected = licenseOf(packages, path) ?? '(no license field)';
    const found = licenseLine.exec(header[0] ?? '')?.groups?.license;
    if (found !== expected) {
      findings.push({ kind: 'license', path, expected, found });
    }
    if (!copyrightLine.test(header[1] ?? '')) {
      findings.push({ kind: 'copyright', path });
    }
  }
  return findings;
}

/**
 * Reads the root package, the workspace packages that pnpm-workspace.yaml names, the source files
 * `git ls-files` lists in the repository that holds `cwd`, the gen stages' output globs and the
 * skills that skills-lock.json pins. git runs without the GIT_* variables of a hook.
 * @param {string} cwd
 * @returns {{ packages: WorkspacePackage[], files: SourceFile[], skipped: Skipped }}
 */
export function trackedSources(cwd) {
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
  const tracked = git('-C', top, 'ls-files', '-z')
    .split('\0')
    .filter((path) => path !== '' && exists(path));

  const packages = tracked
    .filter(
      (path) =>
        path === 'package.json' ||
        (posix.basename(path) === 'package.json' &&
          globs.some((glob) => posix.matchesGlob(posix.dirname(path), glob))),
    )
    .map((path) => ({ path, manifest: JSON.parse(read(path)) }));
  const skipped = {
    generated: stages.flatMap((stage) => stage.outputs),
    thirdPartySkills: Object.keys(JSON.parse(read('skills-lock.json')).skills ?? {}),
  };
  const files = tracked
    .filter((path) => sourceExtension.test(path) && !isSkipped(path, skipped))
    .map((path) => ({ path, text: read(path) }));

  return { packages, files, skipped };
}
