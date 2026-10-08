// SPDX-License-Identifier: MIT
import { printSubgraphSchema } from '@apollo/subgraph';
import { Inject, Injectable } from '@nestjs/common';
import {
  AbstractGraphQLDriver,
  type GqlModuleOptions,
  GraphQLFederationFactory,
} from '@nestjs/graphql';
import type { GraphQLSchema } from 'graphql';
import { SubgraphRegistry } from './registry.ts';

export interface InProcessSubgraphOptions extends GqlModuleOptions {
  /** The module's GraphQL name. */
  readonly subgraphName: string;
}

/**
 * Builds a module's federated subgraph schema with Nest's GraphQLFederationFactory, registers it
 * in the SubgraphRegistry and starts no server. It needs neither @nestjs/apollo nor
 * @apollo/server.
 */
@Injectable()
export class InProcessSubgraphDriver extends AbstractGraphQLDriver<InProcessSubgraphOptions> {
  constructor(
    @Inject(GraphQLFederationFactory) private readonly federationFactory: GraphQLFederationFactory,
    @Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry,
  ) {
    super();
  }

  override async generateSchema(options: InProcessSubgraphOptions): Promise<GraphQLSchema> {
    const schema = await this.federationFactory.generateSchema(options);
    this.registry.add({ name: options.subgraphName, sdl: printSubgraphSchema(schema), schema });
    return schema;
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}
}
