// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** The installation's northmes.config.json at the repository root, next to plugins/. */
export const defaultConfigFile = fileURLToPath(
  new URL('../../../../northmes.config.json', import.meta.url),
);

const configSchema = z.object({
  /** The folders of the plugins to load, relative to the file's folder or absolute. */
  plugins: z.array(z.string()),
});

/** What boot reads from northmes.config.json. */
export interface InstallationConfig {
  /** The folders of the plugins to load, as absolute paths, in the order the file lists them. */
  readonly pluginRoots: readonly string[];
}

/** Boot step 1 for the installation (ADR 0002): reads northmes.config.json from file. */
export function readConfigFile(file: string): InstallationConfig {
  const { plugins } = configSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  return { pluginRoots: plugins.map((plugin) => resolve(dirname(file), plugin)) };
}
