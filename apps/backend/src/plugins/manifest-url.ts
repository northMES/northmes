// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The export conditions that Node's import matches, so boot picks the file import would load. */
const importConditions = new Set(['node', 'import', 'default']);

/**
 * The path that an entry of package.json exports names: the entry itself, or the first target in
 * key order whose condition import matches.
 */
function exportTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object' || entry === null) return undefined;
  for (const [condition, target] of Object.entries(entry)) {
    if (importConditions.has(condition)) return exportTarget(target);
  }
  return undefined;
}

/**
 * The file URL of a plugin's manifest: exports["./manifest"] of the package.json in the plugin's
 * folder (ADR 0037).
 */
export function pluginManifestUrl(pluginRoot: string): string {
  const packageJson = pathToFileURL(join(pluginRoot, 'package.json'));
  const { exports } = JSON.parse(readFileSync(packageJson, 'utf8')) as {
    exports?: Record<string, unknown>;
  };
  const target = exportTarget(exports?.['./manifest']);
  if (target === undefined) {
    throw new Error(`No exports["./manifest"] in ${fileURLToPath(packageJson)}`);
  }
  return new URL(target, packageJson).href;
}
