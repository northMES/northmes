// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { BootError } from './boot-error.ts';

/** The installation's northmes.config.json at the repository root, next to plugins/. */
export const defaultConfigFile = fileURLToPath(
  new URL('../../../../northmes.config.json', import.meta.url),
);

const configSchema = z.object({
  /**
   * The NorthMES version the file was written for. The image's version is the one that counts, so
   * the field may be left out; when present it must match (ADR 0038).
   */
  northmes: z.string().optional(),
  /** The folders of the plugins to load, relative to the file's folder or absolute. */
  plugins: z.array(z.string()),
});

/** What boot reads from northmes.config.json. */
export interface InstallationConfig {
  /** The folders of the plugins to load, as absolute paths, in the order the file lists them. */
  readonly pluginRoots: readonly string[];
}

export interface ConfigFileOptions {
  /** The NorthMES version of the running image. */
  readonly imageVersion: string;
}

/**
 * Boot step 1 for the installation (ADR 0002): reads northmes.config.json from file. A version in
 * the file that differs from the image's throws a BootError naming both.
 */
export function readConfigFile(
  file: string,
  { imageVersion }: ConfigFileOptions,
): InstallationConfig {
  const { northmes, plugins } = configSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  if (northmes !== undefined && northmes !== imageVersion) {
    throw new BootError([
      `${file}: config names ${northmes}, this image is ${imageVersion}. Set northmes to ${imageVersion} or remove it`,
    ]);
  }
  return { pluginRoots: plugins.map((plugin) => resolve(dirname(file), plugin)) };
}
