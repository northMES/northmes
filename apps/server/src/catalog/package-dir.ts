// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The folder of the package that holds a manifest, which manifestUrl names. The manifest is the
 * package's source file or its build in dist/, so the folder is the one with the package.json above
 * it.
 */
export function packageDirOf(manifestUrl: string): string {
  let dir = dirname(fileURLToPath(manifestUrl));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No package.json above the manifest ${manifestUrl}`);
    dir = parent;
  }
  return dir;
}
