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
import { composeSupergraph, supergraphHash } from './compose.ts';
import { tracerPrincipalPlugin } from './tracer-principal.ts';
import { inProcessTransport } from './transport.ts';

/** The one GraphQL endpoint of the server. */
export const GATEWAY_PATH = '/graphql';

/** The body of the 503 that /graphql answers before the gateway has its schema. */
const NOT_READY = JSON.stringify({
  errors: [{ message: 'The GraphQL gateway is not ready.', extensions: { code: 'UNAVAILABLE' } }],
});

/** Composes the subgraphs of every module and serves the supergraph (ADR 0015). */
@Injectable()
export class GatewayService implements OnApplicationBootstrap {
  #runtime?: GatewayRuntime;
  #supergraphHash?: string;

  constructor(@Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry) {}

  /** Runs after every subgraph schema exists. A catalog without subgraphs has no supergraph. */
  async onApplicationBootstrap(): Promise<void> {
    const subgraphs = this.registry.all();
    if (subgraphs.length === 0) return;
    const supergraph = composeSupergraph(subgraphs);
    const runtime = createGatewayRuntime({
      supergraph,
      graphqlEndpoint: GATEWAY_PATH,
      // Every subgraph URL is inproc://<name>, and the gateway hands a subgraph without a
      // transport directive to the transport of kind http.
      transports: { http: inProcessTransport(subgraphs) },
      // Resolves the principal once per client request, until E05 replaces the tracer principal.
      plugins: () => [tracerPrincipalPlugin],
      maskedErrors: true,
      landingPage: false,
      graphiql: false,
    });
    // The gateway would otherwise load the supergraph on the first request. Awaiting it here moves
    // supergraph errors to boot, and requests get the 503 until it has resolved.
    await runtime.getSchema();
    this.#runtime = runtime;
    this.#supergraphHash = supergraphHash(supergraph);
  }

  /** The hash of the supergraph the gateway serves, or undefined while it serves none. */
  get supergraphHash(): string | undefined {
    return this.#supergraphHash;
  }

  /** Serves a request to GATEWAY_PATH, or answers 503 while the gateway has no schema. */
  handle(request: IncomingMessage, response: ServerResponse): void {
    if (!this.#runtime) {
      response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' }).end(NOT_READY);
      return;
    }
    void this.#runtime(request, response);
  }
}

@Module({ providers: [GatewayService], exports: [GatewayService] })
export class GatewayModule implements NestModule {
  constructor(@Inject(GatewayService) private readonly gateway: GatewayService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply((request: IncomingMessage, response: ServerResponse) =>
        this.gateway.handle(request, response),
      )
      .forRoutes(GATEWAY_PATH);
  }
}
