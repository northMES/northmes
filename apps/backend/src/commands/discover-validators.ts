// SPDX-License-Identifier: AGPL-3.0-or-later
import { inspect } from 'node:util';
import type { Type } from '@nestjs/common';
import type { CommandProvider, CommandValidatorProvider } from '@northmes/sdk/commands';
import { BootError } from '../boot/boot-error.ts';
import { moduleProviders, providerClassOf } from '../module-providers.ts';
import { DEFAULT_VALIDATOR_TIMEOUT_MS, type RegisteredValidator } from './command-bus.ts';

/** A module or plugin whose Nest module may list commands and command validators. */
export interface ValidatorScope {
  /** The module's id. */
  readonly id: string;
  /** The ids of the modules it depends on. */
  readonly dependsOn?: readonly string[];
  /**
   * Its Nest module, whose providers and those of the modules it imports are read, up to the Nest
   * module of another scope.
   */
  readonly module: Type;
}

/**
 * The command validators among the providers of each module, with the id of that module
 * (ADR 0037). A validator may only be on a command that another module lists with a validatable
 * contract (ADR 0017), from a module whose dependsOn names that owner, and its timeoutMs, when it
 * sets one, is a number above 0 and no longer than the command's limit (ADR 0012 step 6). Owners
 * declare no limit per command yet, so that limit is the host's default. Throws one BootError that
 * lists every rule each validator breaks.
 */
export function discoverValidators(modules: readonly ValidatorScope[]): RegisteredValidator[] {
  // Each module's walk stops at the Nest module of another module or plugin, so a provider counts
  // for the module that declares it, also when another one imports that module to use its services.
  const roots = modules.map(({ module }) => module);
  const listed = modules.map(({ id, module }) => ({
    id,
    classes: moduleProviders(module, new Set(roots.filter((root) => root !== module))).map(
      providerClassOf,
    ),
  }));
  const validators = listed.flatMap(({ id, classes }) =>
    classes.flatMap((provider) => {
      const { validator } = (provider ?? {}) as Partial<CommandValidatorProvider>;
      return validator ? [{ module: id, validator }] : [];
    }),
  );
  const owners = ownersOfValidatableCommands(listed);
  const dependsOn = new Map(modules.map(({ id, dependsOn = [] }) => [id, dependsOn]));
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
    if (timeoutMs !== undefined && !isTimeLimit(timeoutMs)) {
      problems.push(
        `Validator ${validator.name} of module ${module} sets timeoutMs to ${inspect(timeoutMs)}. Set it above 0 and at most ${DEFAULT_VALIDATOR_TIMEOUT_MS}, the limit of ${command}, or remove it`,
      );
    }
  }
  if (problems.length > 0) throw new BootError(problems);
  return validators;
}

/**
 * Whether a validator's timeoutMs is a number above 0 and no longer than the command's limit. A
 * plugin is plain JavaScript, so the value may be of any type: a string such as '500' or true
 * would pass a comparison alone, and setTimeout would read true as 1 ms.
 */
function isTimeLimit(timeoutMs: unknown): boolean {
  return (
    typeof timeoutMs === 'number' && timeoutMs > 0 && timeoutMs <= DEFAULT_VALIDATOR_TIMEOUT_MS
  );
}

/**
 * The id of the module that owns each validatable command, by command name: the module that lists
 * the command's provider, whose contract says validatable (ADR 0017). A validator's own copy of the
 * contract does not count.
 */
function ownersOfValidatableCommands(
  listed: readonly { readonly id: string; readonly classes: readonly unknown[] }[],
): Map<string, string> {
  const owners = new Map<string, string>();
  for (const { id, classes } of listed) {
    for (const provider of classes) {
      const { command } = (provider ?? {}) as Partial<CommandProvider<unknown, unknown>>;
      if (command?.contract.validatable) owners.set(command.contract.name, id);
    }
  }
  return owners;
}
