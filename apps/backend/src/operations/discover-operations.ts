// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Type } from '@nestjs/common';
import { type BoundOperationsProvider, isBoundOperationsProvider } from '@northmes/sdk/operations';
import { BootError } from '../boot/boot-error.ts';
import { moduleProviders, providerClassOf } from '../module-providers.ts';

/** A module or plugin whose Nest module may list bound operations, with its permissions. */
export interface OperationScopeEntry {
  /** The module's id. */
  readonly id: string;
  /** Its Nest module, whose providers and those of the modules it imports are read. */
  readonly module: Type;
  /** The permissions it declares, resource to actions. */
  readonly permissions?: Readonly<Record<string, readonly string[]>>;
}

/** One bound operation, as the runner finds it by its contract name. */
export interface DiscoveredOperation {
  /** The id of the module that binds it. */
  readonly module: string;
  /** The operation's key in its declaration, such as get. */
  readonly key: string;
  /** The provider bindOperations returned, which Nest instantiates in the module. */
  readonly provider: BoundOperationsProvider;
}

/** The keys `<resource>:<action>` of a module's permissions. */
function permissionKeys(permissions: OperationScopeEntry['permissions'] = {}): Set<string> {
  return new Set(
    Object.entries(permissions).flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}:${action}`),
    ),
  );
}

/**
 * The operations that each module binds with bindOperations among its providers, by contract name
 * (ADR 0073). A module binds only its own declarations, each contract name is bound once, and a
 * query checks a permission its module declares (ADR 0010); the command bus already holds commands
 * to that rule. A provider counts for the module whose walk reaches it first, up to the Nest
 * module of another module. Throws one BootError that lists every problem.
 */
export function discoverOperations(
  modules: readonly OperationScopeEntry[],
): Map<string, DiscoveredOperation> {
  const roots = modules.map(({ module }) => module);
  const found = new Map<string, DiscoveredOperation>();
  const problems: string[] = [];
  for (const { id, module, permissions } of modules) {
    const declared = permissionKeys(permissions);
    const providers = moduleProviders(module, new Set(roots.filter((root) => root !== module)))
      .map(providerClassOf)
      .filter(isBoundOperationsProvider);
    for (const provider of providers) {
      const { declaration } = provider;
      if (declaration.module !== id) {
        problems.push(
          `Module ${id} lists the operations of ${declaration.module}.${declaration.resource}; a module binds only its own operations (ADR 0073)`,
        );
        continue;
      }
      for (const [key, operation] of Object.entries(declaration.operations)) {
        const { name, permission } = operation.contract;
        const bound = found.get(name);
        if (bound) {
          problems.push(
            `Operation ${name} is bound by ${bound.provider.name} of module ${bound.module} and by ${provider.name} of module ${id}`,
          );
        }
        const isQuery = 'kind' in operation.contract && operation.contract.kind === 'query';
        if (isQuery && !declared.has(permission)) {
          problems.push(
            `Operation ${name} of module ${id} checks permission ${permission}, which module ${id} does not declare`,
          );
        }
        if (!bound) found.set(name, { module: id, key, provider });
      }
    }
  }
  if (problems.length > 0) throw new BootError(problems);
  return found;
}
