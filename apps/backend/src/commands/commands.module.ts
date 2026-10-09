// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module } from '@nestjs/common';
import { COMMAND_BUS } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { type CommandScope, checkCommandPermissions } from './check-commands.ts';
import { CommandBusImpl } from './command-bus.ts';
import { discoverValidators, type ValidatorScope } from './discover-validators.ts';

/** Provides the command bus under COMMAND_BUS to every module's Nest module. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class CommandsModule {
  /**
   * `servers` are the catalog's modules and plugins with a Nest module, in boot order. The command
   * validators are those that each Nest module, or a module it imports, lists among its providers.
   * forRoot finds them, and checks the permission of every command, before Nest builds any
   * provider, so a BootError from checkCommandPermissions or discoverValidators reaches the caller
   * of AppModule.forRoot.
   */
  static forRoot(servers: readonly (ValidatorScope & CommandScope)[]): DynamicModule {
    checkCommandPermissions(servers);
    const validators = discoverValidators(servers);
    return {
      module: CommandsModule,
      global: true,
      providers: [
        {
          provide: COMMAND_BUS,
          inject: [DATABASE],
          useFactory: (database: ScopedDatabase<unknown>) =>
            new CommandBusImpl(database, { modules: servers.map(({ id }) => id), validators }),
        },
      ],
      exports: [COMMAND_BUS],
    };
  }
}
