// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModuleManifest } from '@northmes/sdk';
import type { CommandValidatorProvider } from '@northmes/sdk/commands';
import { BootError } from '../boot/boot-error.ts';
import type { RegisteredValidator } from './command-bus.ts';

/** The providers that a module's server entry lists in its Nest module. */
export interface ModuleProviders {
  /** The module's id. */
  readonly module: string;
  readonly providers: readonly unknown[];
}

/**
 * The command validators among the providers of each module, with the id of that module
 * (ADR 0037). `catalog` holds the manifests of the modules with a server entry. A validator may
 * only be on a command that its owner's manifest declares validatable, from a module whose
 * dependsOn names the owner. Throws one BootError that lists every validator that breaks either
 * rule.
 */
export function discoverValidators(
  catalog: readonly ModuleManifest[],
  providers: readonly ModuleProviders[],
): RegisteredValidator[] {
  const validators = providers.flatMap(({ module, providers: listed }) =>
    listed.flatMap((provider) => {
      const { validator } = (provider ?? {}) as Partial<CommandValidatorProvider>;
      return validator ? [{ module, validator }] : [];
    }),
  );
  const owners = ownersOfValidatableCommands(catalog);
  const dependsOn = new Map(catalog.map(({ id, dependsOn = [] }) => [id, dependsOn]));
  const problems: string[] = [];
  for (const { module, validator } of validators) {
    const command = validator.contract.name;
    const where = `Validator ${validator.name} of module ${module} is on ${command}`;
    const owner = owners.get(command);
    if (!owner) {
      problems.push(`${where}, which no module declares validatable`);
    } else if (!dependsOn.get(module)?.includes(owner)) {
      problems.push(`${where} of module ${owner}, which is not in the dependsOn of ${module}`);
    }
  }
  if (problems.length > 0) throw new BootError(problems);
  return validators;
}

/** The id of the module that declares each validatable command, by command name. */
function ownersOfValidatableCommands(catalog: readonly ModuleManifest[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const { id, commands = {} } of catalog) {
    for (const [name, { validatable }] of Object.entries(commands)) {
      if (validatable) owners.set(name, id);
    }
  }
  return owners;
}
