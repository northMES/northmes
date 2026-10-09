// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { discoverOperations, type OperationScopeEntry } from './discover-operations.ts';
import { OperationRunner } from './operation-runner.ts';

/** Provides the OperationRunner to the app's adapters (ADR 0073). */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class OperationsModule {
  /**
   * `servers` are the catalog's modules and plugins with a Nest module, in boot order. forRoot finds
   * the operations each binds before Nest builds any provider, so a BootError from
   * discoverOperations reaches the caller of AppModule.forRoot.
   */
  static forRoot(servers: readonly OperationScopeEntry[]): DynamicModule {
    const operations = discoverOperations(servers);
    return {
      module: OperationsModule,
      global: true,
      providers: [
        {
          provide: OperationRunner,
          inject: [ModuleRef],
          useFactory: (moduleRef: ModuleRef) => new OperationRunner(moduleRef, operations),
        },
      ],
      exports: [OperationRunner],
    };
  }
}
