// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Type } from '@nestjs/common';
import { RESOLVER_NAME_METADATA, RESOLVER_TYPE_METADATA } from '@nestjs/graphql';
import { moduleNames } from '@northmes/sdk';
import { moduleProviders } from '../module-providers.ts';

/** A module or plugin in the catalog: its id and its Nest module. */
export interface RootFieldOwner {
  readonly id: string;
  readonly module: Type;
}

const rootTypes = new Set(['Query', 'Mutation', 'Subscription']);

/** The root fields a resolver class declares, as Query.name, Mutation.name or Subscription.name. */
function rootFieldsOfResolver(resolver: Type): string[] {
  const fields: string[] = [];
  for (let proto = resolver.prototype; proto && proto !== Object.prototype; ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      const method = Object.getOwnPropertyDescriptor(proto, key)?.value;
      if (typeof method !== 'function') continue;
      const type = Reflect.getMetadata(RESOLVER_TYPE_METADATA, method);
      if (!rootTypes.has(type)) continue;
      fields.push(`${type}.${Reflect.getMetadata(RESOLVER_NAME_METADATA, method) ?? key}`);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return fields;
}

/**
 * The root fields of a server entry, as Query.name, Mutation.name or Subscription.name: those of
 * every resolver that its Nest module, or a module it imports, lists.
 */
export function rootFieldsOf({ module }: Pick<RootFieldOwner, 'module'>): string[] {
  return moduleProviders(module)
    .filter((provider): provider is Type => typeof provider === 'function')
    .flatMap(rootFieldsOfResolver);
}

/**
 * NORTHMES_ROOT_FIELD_PREFIX: every Query, Mutation and Subscription field of the one schema starts
 * with the GraphQL name of the module that declares it and an upper-case letter, as
 * planningReleaseProductionOrder does. A field belongs to the server entry whose Nest module, or a
 * module it imports, lists the resolver. Returns one problem per field that breaks the rule.
 */
export function rootFieldProblems(owners: readonly RootFieldOwner[]): string[] {
  return owners.flatMap((owner) => {
    const { id } = owner;
    const prefix = moduleNames(id).gql;
    const prefixed = new RegExp(`^${prefix}[A-Z]`);
    return rootFieldsOf(owner)
      .filter((field) => !prefixed.test(field.slice(field.indexOf('.') + 1)))
      .map(
        (field) =>
          `[NORTHMES_ROOT_FIELD_PREFIX] ${field} of module ${id} must start with "${prefix}" and an upper-case letter`,
      );
  });
}
