import { type DynamicModule, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PermissionGuard } from "./sdk/permission.js";
import { defineSubgraph, SubgraphRegistryModule } from "./sdk/subgraph.js";
import { CoreModule } from "./modules/core/core.module.js";
import { PlanningModule } from "./modules/planning/planning.module.js";
import { HelloModule } from "../examples/plugin-hello/hello.module.js";
import { GatewayModule } from "./gateway/gateway.module.js";
import { BrokenModule } from "../examples/plugin-broken/broken.module.js";

/** What northmes.config.ts would list; plugins are enabled by configuration. */
export interface EnabledModule {
  name: string;
  module: any;
  subscriptions?: boolean;
}

export const defaultModules = (): EnabledModule[] => {
  const mods: EnabledModule[] = [
    { name: "core", module: CoreModule },
    { name: "planning", module: PlanningModule, subscriptions: true },
  ];
  const plugins = process.env.SPIKE_PLUGINS?.split(",") ?? [];
  if (plugins.includes("hello")) mods.push({ name: "hello", module: HelloModule });
  if (plugins.includes("broken")) mods.push({ name: "broken", module: BrokenModule });
  return mods;
};

@Module({})
export class AppModule {
  static forRoot(mods: EnabledModule[] = defaultModules()): DynamicModule {
    return {
      module: AppModule,
      imports: [
        SubgraphRegistryModule,
        ...mods.map((m) => m.module),
        ...mods.map((m) => defineSubgraph({ name: m.name, module: m.module, subscriptions: m.subscriptions })),
        GatewayModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: PermissionGuard }],
    };
  }
}
