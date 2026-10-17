// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type DynamicModule, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { DiscoveredOperation } from './discover-operations.ts';
import { OperationRunner } from './operation-runner.ts';

/** Provides the OperationRunner to the app's adapters (ADR 0073). */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class OperationsModule {
  /**
   * `operations` are the ones the catalog's modules and plugins bind, which AppModule.forRoot finds
   * with discoverOperations before Nest builds any provider, so its BootError reaches the caller.
   */
  static forRoot(operations: ReadonlyMap<string, DiscoveredOperation>): DynamicModule {
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
