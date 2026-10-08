// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModuleManifest } from '@northmes/sdk';
import type { CommandValidatorProvider } from '@northmes/sdk/commands';
import type { RegisteredValidator } from './command-bus.ts';

/** The providers that a module's server entry lists in its Nest module. */
export interface ModuleProviders {
  /** The module's id. */
  readonly module: string;
  readonly providers: readonly unknown[];
}

/**
 * The command validators among the providers of each module, with the id of that module
 * (ADR 0037). `catalog` holds the manifests of the modules with a server entry.
 */
export function discoverValidators(
  _catalog: readonly ModuleManifest[],
  providers: readonly ModuleProviders[],
): RegisteredValidator[] {
  return providers.flatMap(({ module, providers: listed }) =>
    listed.flatMap((provider) => {
      const { validator } = (provider ?? {}) as Partial<CommandValidatorProvider>;
      return validator ? [{ module, validator }] : [];
    }),
  );
}
