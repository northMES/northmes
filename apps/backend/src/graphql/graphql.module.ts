// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AbstractGraphQLDriver, type GqlModuleOptions, GraphQLModule } from '@nestjs/graphql';
import type { GraphQLSchema } from 'graphql';
import { GRAPHQL_PATH } from './server.ts';
import { YogaDriver } from './yoga.driver.ts';

/** The descriptions of the root types, which code-first decorators cannot set. */
const rootDescriptions = {
  Query:
    'The reads of the NorthMES API. Each root field starts with the GraphQL name of the module that owns it, such as core or planning.',
  Mutation:
    'The writes of the NorthMES API. Each mutation sends one command, which checks its permission and its input before it changes anything.',
  Subscription: 'The live updates of the NorthMES API.',
} as const;

/** Gives the root types of `schema` their descriptions. */
export function describeRootTypes(schema: GraphQLSchema): GraphQLSchema {
  for (const type of [
    schema.getQueryType(),
    schema.getMutationType(),
    schema.getSubscriptionType(),
  ]) {
    if (type && type.name in rootDescriptions) {
      type.description = rootDescriptions[type.name as keyof typeof rootDescriptions];
    }
  }
  return schema;
}

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
      transformSchema: describeRootTypes,
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
