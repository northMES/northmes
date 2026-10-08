// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from '@northmes/sdk/errors';
import {
  type DefineSubgraphOptions,
  defineSubgraph,
  SubgraphRegistryModule,
} from '@northmes/sdk/graphql';
import { DatabaseModule } from './db/database.module.ts';
import { GatewayModule } from './gateway/gateway.module.ts';
import { WebModule } from './web/web.module.ts';

/** The root module of the server. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class AppModule {
  /**
   * Imports config first: the ConfigModule that boot created before it imported any manifest
   * (ADR 0060). Then the nm_app pool and the ScopedDatabase on it, every module's Nest module, one
   * subgraph per module and the gateway that serves them on /graphql (ADR 0015). The SDK's
   * exception filter is registered here and nowhere else (ADR 0012).
   */
  static forRoot(
    config: DynamicModule,
    subgraphs: readonly DefineSubgraphOptions[] = [],
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        config,
        DatabaseModule,
        SubgraphRegistryModule,
        ...subgraphs.map((subgraph) => subgraph.module),
        ...subgraphs.map((subgraph) => defineSubgraph(subgraph)),
        GatewayModule,
        WebModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
    };
  }
}
