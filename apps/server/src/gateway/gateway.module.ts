// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGatewayRuntime, type GatewayRuntime } from '@graphql-hive/gateway-runtime';
import {
  Inject,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { SubgraphRegistry } from '@northmes/sdk/graphql';
import { composeSupergraph } from './compose.ts';
import { inProcessTransport } from './transport.ts';

/** The one GraphQL endpoint of the server. */
export const GATEWAY_PATH = '/graphql';

/** Composes the subgraphs of every module and serves the supergraph (ADR 0015). */
@Injectable()
export class GatewayService implements OnApplicationBootstrap {
  #runtime?: GatewayRuntime;

  constructor(@Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry) {}

  /** Runs after every subgraph schema exists. A catalog without subgraphs has no supergraph. */
  async onApplicationBootstrap(): Promise<void> {
    const subgraphs = this.registry.all();
    if (subgraphs.length === 0) return;
    this.#runtime = createGatewayRuntime({
      supergraph: composeSupergraph(subgraphs),
      graphqlEndpoint: GATEWAY_PATH,
      // Every subgraph URL is inproc://<name>, and the gateway hands a subgraph without a
      // transport directive to the transport of kind http.
      transports: { http: inProcessTransport(subgraphs) },
      maskedErrors: true,
      landingPage: false,
      graphiql: false,
    });
    await this.#runtime.getSchema();
  }

  /** Serves a request to GATEWAY_PATH. */
  handle(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    if (!this.#runtime) {
      next();
      return;
    }
    void this.#runtime(request, response);
  }
}

@Module({ providers: [GatewayService] })
export class GatewayModule implements NestModule {
  constructor(@Inject(GatewayService) private readonly gateway: GatewayService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((request: IncomingMessage, response: ServerResponse, next: () => void) =>
        this.gateway.handle(request, response, next),
      )
      .forRoutes(GATEWAY_PATH);
  }
}
