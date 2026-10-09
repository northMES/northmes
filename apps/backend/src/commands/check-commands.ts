// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Type } from '@nestjs/common';
import type { Command, CommandProvider } from '@northmes/sdk/commands';
import { BootError } from '../boot/boot-error.ts';
import { moduleProviders, providerClassOf } from '../module-providers.ts';

/** A module or plugin whose Nest module may list commands, with the permissions it declares. */
export interface CommandScope {
  /** The module's id. */
  readonly id: string;
  /** Its Nest module, whose providers and those of the modules it imports are read. */
  readonly module: Type;
  /** The permissions it declares, resource to actions, as its manifest or entry lists them. */
  readonly permissions?: Readonly<Record<string, readonly string[]>>;
}

/** The keys `<resource>:<action>` of a module's permissions. */
function permissionKeys(permissions: CommandScope['permissions'] = {}): Set<string> {
  return new Set(
    Object.entries(permissions).flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}:${action}`),
    ),
  );
}

/**
 * Checks that the contract of every command among the modules' providers names the permission the
 * command bus checks (ADR 0012 step 3), and that the module that lists the command declares it
 * (ADR 0010). A command belongs to the first module in boot order that lists it, so a module that
 * imports another module's Nest module does not take its commands. Throws one BootError that lists
 * every command that breaks a rule. A plugin is plain JavaScript, so nothing before boot stops a
 * contract without a permission.
 */
export function checkCommandPermissions(modules: readonly CommandScope[]): void {
  const seen = new Set<Command>();
  const problems: string[] = [];
  for (const { id, module, permissions } of modules) {
    const declared = permissionKeys(permissions);
    for (const provider of moduleProviders(module).map(providerClassOf)) {
      const { command } = (provider ?? {}) as Partial<CommandProvider<unknown, unknown>>;
      if (!command || seen.has(command)) continue;
      seen.add(command);
      const { name, permission } = command.contract;
      if (typeof permission !== 'string' || permission === '') {
        problems.push(
          `Command ${name} of module ${id} names no permission. Its contract needs permission, such as ${id}.<entity>:<action>, which the command bus checks at the scope of the row the command changes (ADR 0012)`,
        );
      } else if (!declared.has(permission)) {
        problems.push(
          `Command ${name} of module ${id} checks permission ${permission}, which module ${id} does not declare`,
        );
      }
    }
  }
  if (problems.length > 0) throw new BootError(problems);
}
