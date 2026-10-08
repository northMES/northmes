// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ModuleManifest } from '@northmes/sdk';
import type { CommandValidatorProvider } from '@northmes/sdk/commands';
import { BootError } from '../boot/boot-error.ts';
import { DEFAULT_VALIDATOR_TIMEOUT_MS, type RegisteredValidator } from './command-bus.ts';

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
 * dependsOn names the owner, and its timeoutMs, when it sets one, is above 0 and no longer than
 * the command's limit (ADR 0012 step 6). Owners declare no limit per command yet, so that limit is
 * the host's default. Throws one BootError that lists every rule each validator breaks.
 */
export function discoverValidators(
  catalog: readonly ModuleManifest[],
  providers: readonly ModuleProviders[],
): RegisteredValidator[] {
  const validators = providers.flatMap(({ module, providers: listed }) =>
    listed.flatMap((provider) => {
      const { validator } = (classOf(provider) ?? {}) as Partial<CommandValidatorProvider>;
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
    const { timeoutMs } = validator;
    if (timeoutMs !== undefined && !(timeoutMs > 0 && timeoutMs <= DEFAULT_VALIDATOR_TIMEOUT_MS)) {
      problems.push(
        `Validator ${validator.name} of module ${module} sets timeoutMs to ${timeoutMs}. Set it above 0 and at most ${DEFAULT_VALIDATOR_TIMEOUT_MS}, the limit of ${command}, or remove it`,
      );
    }
  }
  if (problems.length > 0) throw new BootError(problems);
  return validators;
}

/**
 * The class that Nest instantiates for a listed provider: useClass of a class provider, or the
 * entry itself. A validator listed either way is found, so none is skipped (ADR 0037).
 */
function classOf(provider: unknown): unknown {
  if (typeof provider === 'object' && provider !== null && 'useClass' in provider) {
    return provider.useClass;
  }
  return provider;
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
