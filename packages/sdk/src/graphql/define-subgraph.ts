// SPDX-License-Identifier: MIT
import type { DynamicModule, Type } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { InProcessSubgraphDriver, type InProcessSubgraphOptions } from './driver.ts';

export interface DefineSubgraphOptions {
  /** The module's GraphQL name from moduleNames, so the root field prefix has one source. */
  readonly name: string;
  /** The Nest module that holds the subgraph's resolvers. */
  readonly module: Type;
}

/**
 * The host calls this for every module with a server entry; module authors never configure
 * GraphQLModule.
 */
export function defineSubgraph({ name }: DefineSubgraphOptions): DynamicModule {
  return GraphQLModule.forRoot<InProcessSubgraphOptions>({
    driver: InProcessSubgraphDriver,
    subgraphName: name,
    autoSchemaFile: { federation: 2 },
  });
}
