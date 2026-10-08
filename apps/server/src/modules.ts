// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The manifests of the modules that ship in the repository, by import specifier. Boot imports them
 * after the configuration check and orders them by their dependencies (ADR 0002, ADR 0003).
 */
export const inRepoManifests: readonly string[] = [
  '@northmes/module-core/manifest',
  '@northmes/module-planning/manifest',
];
