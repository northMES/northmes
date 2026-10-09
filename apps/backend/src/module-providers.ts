// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DynamicModule, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';

/** A Nest module class, or the class of a dynamic module. */
function moduleClassOf(entry: unknown): Type | undefined {
  if (typeof entry === 'function') return entry as Type;
  return (entry as DynamicModule | undefined)?.module;
}

/**
 * The providers that a Nest module and the modules it imports list in their @Module decorators, as
 * listed: a class, or a provider object such as { provide, useClass }. A module imported twice is
 * read once, and a module already in `seen` is not read, which lets a caller stop the walk there.
 */
export function moduleProviders(module: Type, seen = new Set<Type>()): unknown[] {
  if (seen.has(module)) return [];
  seen.add(module);
  const providers: unknown[] = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) ?? [];
  const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? [];
  return [
    ...providers,
    ...imports.flatMap((entry) => {
      const imported = moduleClassOf(entry);
      return imported ? moduleProviders(imported, seen) : [];
    }),
  ];
}

/**
 * The class that Nest instantiates for a listed provider: useClass of a class provider, or the
 * entry itself.
 */
export function providerClassOf(provider: unknown): unknown {
  if (typeof provider === 'object' && provider !== null && 'useClass' in provider) {
    return provider.useClass;
  }
  return provider;
}
