import { type DynamicModule, Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { defineSubgraph, PermissionGuard, SubgraphRegistryModule } from "@northmes/sdk";
import { CommandsModule } from "./commands.js";
import { GatewayModule } from "./gateway/gateway.module.js";
import { CATALOG, type LoadedCatalog } from "./tokens.js";
import { WebModule } from "./web.js";

/**
 * Global, and on purpose without imports: @nestjs/graphql walks `include` modules through their
 * imports, and Nest adds every global module to every module's imports. A global module that
 * imported module packages would leak their resolvers into every subgraph.
 */
@Global()
@Module({})
export class CatalogModule {
  static forRoot(catalog: LoadedCatalog): DynamicModule {
    return { module: CatalogModule, providers: [{ provide: CATALOG, useValue: catalog }], exports: [CATALOG] };
  }
}

@Module({})
export class AppModule {
  static forRoot(catalog: LoadedCatalog): DynamicModule {
    const servers = catalog.ordered.filter((m) => catalog.serverModules.has(m.manifest.id));
    return {
      module: AppModule,
      imports: [
        CatalogModule.forRoot(catalog),
        SubgraphRegistryModule,
        CommandsModule,
        ...servers.map((m) => catalog.serverModules.get(m.manifest.id)!),
        ...servers.map((m) => defineSubgraph({ name: m.names.gql, module: catalog.serverModules.get(m.manifest.id)!, subscriptions: m.manifest.subscriptions })),
        GatewayModule,
        WebModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: PermissionGuard }],
    };
  }
}
