// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module, type Type } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from '@northmes/sdk/errors';
import { BootError } from './boot/boot-error.ts';
import { CommandsModule } from './commands/commands.module.ts';
import { type DatabaseMode, DatabaseModule } from './db/database.module.ts';
import { GraphqlModule } from './graphql/graphql.module.ts';
import { rootFieldProblems, rootFieldsOf } from './graphql/root-fields.ts';
import { WebOriginsModule } from './http/web-origins.module.ts';
import { OperationsModule } from './operations/operations.module.ts';
import { WebModule } from './web/web.module.ts';

/**
 * The Nest module of an in-repo module or of a plugin's server entry, which boot step 6 collects.
 */
export interface ServerEntry {
  /** The module's id. */
  readonly id: string;
  /** Its Nest module, whose resolvers join the one schema. */
  readonly module: Type;
  /** The ids of the modules it depends on. */
  readonly dependsOn: readonly string[];
  /**
   * The permissions it declares, resource to actions. Its commands may check only these
   * (ADR 0010).
   */
  readonly permissions?: Readonly<Record<string, readonly string[]>>;
}

/** How AppModule.forRoot builds the app beyond its config and Nest modules. */
export interface AppOptions {
  /** What the app connects to. It defaults to 'app'; pnpm northmes migrate passes 'none'. */
  readonly database?: DatabaseMode;
  /** The origins of the web app, webOrigins in northmes.config.json. It defaults to none. */
  readonly webOrigins?: readonly string[];
}

/** The root module of the server. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class AppModule {
  /**
   * Imports config first: the ConfigModule that boot created before it imported any plugin
   * manifest (ADR 0060). Then the web origins and the origin rule that runs before every route,
   * the database that `options.database` names (the nm_app pool and the
   * ScopedDatabase on it, or no pool for pnpm northmes migrate), the command bus, the operation
   * runner with the operations every module binds, the Nest module of
   * every in-repo module and plugin in boot order, and the GraphQL module that builds one schema from their resolvers and serves it on
   * /graphql when they declare a Query field. `servers` are in boot order. A root field without its
   * module's prefix throws one BootError before Nest builds anything. The SDK's exception filter is
   * registered here and nowhere else (ADR 0012).
   */
  static forRoot(
    config: DynamicModule,
    servers: readonly ServerEntry[] = [],
    { database = 'app', webOrigins = [] }: AppOptions = {},
  ): DynamicModule {
    const problems = rootFieldProblems(servers);
    if (problems.length > 0) throw new BootError(problems);
    // A schema needs a Query field, so a catalog whose modules declare none serves no /graphql.
    const declaresQuery = servers.some((server) =>
      rootFieldsOf(server).some((field) => field.startsWith('Query.')),
    );
    return {
      module: AppModule,
      imports: [
        config,
        WebOriginsModule.forRoot(webOrigins),
        DatabaseModule.forRoot(database),
        CommandsModule.forRoot(servers),
        OperationsModule.forRoot(servers),
        ...servers.map((server) => server.module),
        ...(declaresQuery ? [GraphqlModule] : []),
        WebModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
    };
  }
}
