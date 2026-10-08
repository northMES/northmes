// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import type { ModuleManifest } from '@northmes/sdk';
import { COMMAND_BUS } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { CommandBusImpl } from './command-bus.ts';
import { discoverValidators } from './discover-validators.ts';

/** A catalog module with a server entry: its manifest and the Nest module of that entry. */
export interface ServerModule {
  readonly manifest: ModuleManifest;
  readonly module: Type;
}

/** The providers that a Nest module lists in its @Module decorator. */
function providersOf(module: Type): readonly unknown[] {
  return Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) ?? [];
}

/** Provides the command bus under COMMAND_BUS to every module's Nest module. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class CommandsModule {
  /**
   * `servers` are the catalog's modules with a server entry, in boot order. The command validators
   * are those that each server module lists among the providers of its Nest module. forRoot finds
   * them before Nest builds any provider, so a BootError from discoverValidators reaches the caller
   * of AppModule.forRoot.
   */
  static forRoot(servers: readonly ServerModule[]): DynamicModule {
    const validators = discoverValidators(
      servers.map(({ manifest }) => manifest),
      servers.map(({ manifest, module }) => ({
        module: manifest.id,
        providers: providersOf(module),
      })),
    );
    return {
      module: CommandsModule,
      global: true,
      providers: [
        {
          provide: COMMAND_BUS,
          inject: [DATABASE],
          useFactory: (database: ScopedDatabase<unknown>) =>
            new CommandBusImpl(database, {
              modules: servers.map(({ manifest }) => manifest.id),
              validators,
            }),
        },
      ],
      exports: [COMMAND_BUS],
    };
  }
}
