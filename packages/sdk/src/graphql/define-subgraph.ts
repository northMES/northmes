// SPDX-License-Identifier: MIT
import type { DynamicModule, Type } from '@nestjs/common';
import { type BuildSchemaOptions, type Federation2Config, GraphQLModule } from '@nestjs/graphql';
import { InProcessSubgraphDriver, type InProcessSubgraphOptions } from './driver.ts';
import { entityStubsOf } from './entity-ref.ts';

/**
 * @nestjs/graphql 14 links federation v2.14 by default, and the composition library accepts v2.0
 * to v2.9, so every subgraph pins v2.9 and imports only the directives NorthMES uses (ADR 0015).
 */
const FEDERATION_LINK: Federation2Config = {
  version: 2,
  importUrl: 'https://specs.apollo.dev/federation/v2.9',
  directives: [
    '@key',
    '@shareable',
    '@external',
    '@requires',
    '@provides',
    '@inaccessible',
    '@tag',
    '@override',
    '@interfaceObject',
    '@cost',
    '@listSize',
  ],
};

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
export function defineSubgraph({ name, module }: DefineSubgraphOptions): DynamicModule {
  const stubs = entityStubsOf(module);
  const buildSchemaOptions: BuildSchemaOptions & { includeModules: Type[] } = {
    // @nestjs/graphql 14 filters types by registerIn only when it receives includeModules, and on
    // the federation path it passes include on to the resolvers but not to the type filter. This
    // internal key reaches the filter, so each module's types stay in its own subgraph.
    includeModules: [module],
    orphanedTypes: stubs,
  };
  return GraphQLModule.forRoot<InProcessSubgraphOptions>({
    driver: InProcessSubgraphDriver,
    subgraphName: name,
    // entityRef names each stub class after its GraphQL type.
    entityRefs: stubs.map((stub) => stub.name),
    include: [module],
    autoSchemaFile: { federation: FEDERATION_LINK },
    // Guards, interceptors and filters also run on fields reached through _entities.
    fieldResolverEnhancers: ['guards', 'interceptors', 'filters'],
    buildSchemaOptions,
  });
}
