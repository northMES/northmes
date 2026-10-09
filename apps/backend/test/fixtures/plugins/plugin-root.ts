// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModuleManifest } from '@northmes/sdk';
import type { BootOptions } from '../../../src/boot/boot.ts';
import { pluginManifestUrl } from '../../../src/plugins/manifest-url.ts';

/** A plugin's folder under a test's temporary folder, with the migration files it was given. */
export interface FixturePlugin {
  /** The plugin's folder, which northmes.config.json lists. */
  readonly root: string;
  /** The specifier boot imports the plugin's manifest by. */
  readonly manifestUrl: string;
  readonly manifest: ModuleManifest;
}

/**
 * Writes the folder of a plugin with `manifest` into dir: a package.json whose exports name
 * ./manifest.js, and a migrations folder with `migrations` by file name. The manifest file itself
 * is not written; importPlugins hands boot the manifest object.
 */
export function writePlugin(
  dir: string,
  manifest: ModuleManifest,
  migrations: Readonly<Record<string, string>> = {},
): FixturePlugin {
  const root = join(dir, manifest.id);
  mkdirSync(join(root, 'migrations'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: `@acme/${manifest.id}`, exports: { './manifest': './manifest.js' } })}\n`,
  );
  for (const [name, sql] of Object.entries(migrations)) {
    writeFileSync(join(root, 'migrations', name), sql);
  }
  return { root, manifestUrl: pluginManifestUrl(root), manifest };
}

/** Writes a northmes.config.json into dir that lists the plugins, and returns its path. */
export function writeConfig(dir: string, plugins: readonly FixturePlugin[]): string {
  const file = join(dir, 'northmes.config.json');
  writeFileSync(file, `${JSON.stringify({ plugins: plugins.map(({ root }) => root) })}\n`);
  return file;
}

/** The importManifest of boot that returns each plugin's manifest by its specifier. */
export function importPlugins(
  ...plugins: readonly FixturePlugin[]
): BootOptions['importManifest'] {
  const bySpecifier = new Map(plugins.map((plugin) => [plugin.manifestUrl, plugin.manifest]));
  return async (specifier) => {
    const manifest = bySpecifier.get(specifier);
    if (!manifest) throw new Error(`no fixture plugin for ${specifier}`);
    return { default: manifest };
  };
}
