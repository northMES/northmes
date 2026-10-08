// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { COMMAND_BUS, type CommandValidatorProvider } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { CommandBusImpl, type RegisteredValidator } from './command-bus.ts';

/** A catalog module with a server entry: its id and the Nest module of that entry. */
export interface ServerModule {
  readonly id: string;
  readonly module: Type;
}

/**
 * The command validators that each server module lists among the providers of its Nest module,
 * with the id of that module.
 */
function findValidators(
  container: ModulesContainer,
  servers: readonly ServerModule[],
): RegisteredValidator[] {
  const idOf = new Map<unknown, string>(servers.map(({ id, module }) => [module, id]));
  return [...container.values()].flatMap((nestModule) => {
    const id = idOf.get(nestModule.metatype);
    if (!id) return [];
    return [...nestModule.providers.values()].flatMap(({ metatype }) => {
      const { validator } = (metatype ?? {}) as Partial<CommandValidatorProvider>;
      return validator ? [{ module: id, validator }] : [];
    });
  });
}

/** Provides the command bus under COMMAND_BUS to every module's Nest module. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class CommandsModule {
  /** `servers` are the catalog's modules with a server entry, in boot order. */
  static forRoot(servers: readonly ServerModule[]): DynamicModule {
    return {
      module: CommandsModule,
      global: true,
      providers: [
        {
          provide: COMMAND_BUS,
          inject: [DATABASE, ModulesContainer],
          useFactory: (database: ScopedDatabase<unknown>, container: ModulesContainer) =>
            new CommandBusImpl(database, {
              modules: servers.map(({ id }) => id),
              validators: findValidators(container, servers),
            }),
        },
      ],
      exports: [COMMAND_BUS],
    };
  }
}
