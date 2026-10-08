// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AbstractGraphQLDriver, type GqlModuleOptions, GraphQLModule } from '@nestjs/graphql';
import { GRAPHQL_PATH } from './server.ts';
import { YogaDriver } from './yoga.driver.ts';

/**
 * Builds one code-first schema from the resolvers of every module the app imports and serves it on
 * GRAPHQL_PATH. The middleware runs before every route, so the shell's route never takes a GET of
 * GRAPHQL_PATH.
 */
@Module({
  imports: [
    GraphQLModule.forRoot<GqlModuleOptions>({
      driver: YogaDriver,
      path: GRAPHQL_PATH,
      autoSchemaFile: true,
      sortSchema: true,
      // Guards, interceptors and filters also run on field resolvers.
      fieldResolverEnhancers: ['guards', 'interceptors', 'filters'],
    }),
  ],
})
export class GraphqlModule implements NestModule {
  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((request: IncomingMessage, response: ServerResponse, next: () => void) =>
        this.#driver().handle(request, response, next),
      )
      .forRoutes(GRAPHQL_PATH);
  }

  /** The driver that GraphQLModule created, which holds the server once the schema is built. */
  #driver(): YogaDriver {
    return this.moduleRef.get(AbstractGraphQLDriver, { strict: false }) as YogaDriver;
  }
}
