// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModuleManifest } from '@northmes/sdk';
import type { BootOptions } from '../../../src/boot/boot.ts';

/**
 * The boot options that make boot load `manifests` in place of the in-repo modules: one import
 * specifier per manifest, an importManifest that returns the manifest a specifier names, and a
 * resolveManifest that resolves every specifier to this file. The fixtures have no migrations, and
 * boot finds none in the package that holds this file.
 */
export function fixtureCatalog(
  ...manifests: readonly ModuleManifest[]
): Pick<BootOptions, 'manifests' | 'importManifest' | 'resolveManifest'> {
  const bySpecifier = new Map(
    manifests.map((manifest) => [`@northmes/fixture-${manifest.id}/manifest`, manifest]),
  );
  return {
    manifests: [...bySpecifier.keys()],
    importManifest: async (specifier) => {
      const manifest = bySpecifier.get(specifier);
      if (!manifest) throw new Error(`no fixture manifest for ${specifier}`);
      return { default: manifest };
    },
    resolveManifest: () => import.meta.url,
  };
}
