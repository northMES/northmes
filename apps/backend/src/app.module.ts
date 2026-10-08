// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { ModuleManifest } from '@northmes/sdk';
import { DomainErrorFilter } from '@northmes/sdk/errors';
import {
  type DefineSubgraphOptions,
  defineSubgraph,
  SubgraphRegistryModule,
} from '@northmes/sdk/graphql';
import { CommandsModule } from './commands/commands.module.ts';
import { type DatabaseMode, DatabaseModule } from './db/database.module.ts';
import { GatewayModule } from './gateway/gateway.module.ts';
import { WebModule } from './web/web.module.ts';

/** A catalog module's server entry, which boot step 6 imports, named for its subgraph. */
export interface ServerEntry extends DefineSubgraphOptions {
  /** The module's id. */
  readonly id: string;
  /** The module's manifest. */
  readonly manifest: ModuleManifest;
}

/** How AppModule.forRoot builds the app beyond its config and server entries. */
export interface AppOptions {
  /** What the app connects to. It defaults to 'app'; pnpm northmes migrate passes 'none'. */
  readonly database?: DatabaseMode;
}

/** The root module of the server. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class AppModule {
  /**
   * Imports config first: the ConfigModule that boot created before it imported any manifest
   * (ADR 0060). Then the database that `options.database` names (the nm_app pool and the
   * ScopedDatabase on it, or no pool for pnpm northmes migrate), the command bus, every module's
   * Nest module, one subgraph per module and the gateway that serves them on /graphql (ADR 0015).
   * `servers` are in boot order. The SDK's exception filter is registered here and nowhere else
   * (ADR 0012).
   */
  static forRoot(
    config: DynamicModule,
    servers: readonly ServerEntry[] = [],
    { database = 'app' }: AppOptions = {},
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        config,
        DatabaseModule.forRoot(database),
        CommandsModule.forRoot(servers),
        SubgraphRegistryModule,
        ...servers.map((server) => server.module),
        ...servers.map((server) => defineSubgraph(server)),
        GatewayModule,
        WebModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
    };
  }
}
