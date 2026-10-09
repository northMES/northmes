// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AbstractGraphQLDriver, type GqlModuleOptions } from '@nestjs/graphql';
import type { ExecutionArgs } from 'graphql';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import { PrincipalResolver } from '../principal.ts';
import { noPrincipal, type ResolvePrincipal } from './principal.ts';
import { createGraphqlServer, GRAPHQL_PATH, type GraphqlServer } from './server.ts';

/** What the driver passes to graphql-ws as an operation's root value: the enveloped functions. */
interface Enveloped {
  execute(args: ExecutionArgs): unknown;
  subscribe(args: ExecutionArgs): unknown;
}

/**
 * Serves the schema that Nest's GraphQLModule built from every module's resolvers with GraphQL
 * Yoga: HTTP and SSE through GraphqlModule's middleware, and graphql-ws on the upgrade of
 * GRAPHQL_PATH. It stands in for @graphql-yoga/nestjs until a release of it is adoptable.
 */
@Injectable()
export class YogaDriver extends AbstractGraphQLDriver<GqlModuleOptions> {
  #server?: GraphqlServer;
  #sockets?: WebSocketServer;

  @Inject(ModuleRef) private readonly moduleRef!: ModuleRef;

  async start(options: GqlModuleOptions): Promise<void> {
    if (!options.schema) throw new Error('YogaDriver started without a schema');
    const server = createGraphqlServer(options.schema, {
      resolvePrincipal: this.#resolvePrincipal(),
    });
    this.#server = server;
    this.#sockets = this.#serveGraphqlWs(server);
  }

  async stop(): Promise<void> {
    const sockets = this.#sockets;
    if (!sockets) return;
    for (const client of sockets.clients) client.terminate();
    await new Promise((resolve) => sockets.close(resolve));
  }

  /**
   * The core module's PrincipalResolver, which resolves a request's principal from its bearer
   * token. An app without core, such as one of fixture modules in a test, resolves none.
   */
  #resolvePrincipal(): ResolvePrincipal {
    let resolver: PrincipalResolver;
    try {
      resolver = this.moduleRef.get(PrincipalResolver, { strict: false });
    } catch {
      return noPrincipal;
    }
    return (headers) => resolver.resolve(headers);
  }

  /** Serves a request to GRAPHQL_PATH, or hands it on while the schema is not built yet. */
  handle(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    if (this.#server) void this.#server(request, response);
    else next();
  }

  /** Serves graphql-ws on the upgrade of GRAPHQL_PATH, through the same server as HTTP. */
  #serveGraphqlWs(server: GraphqlServer): WebSocketServer {
    const sockets = new WebSocketServer({ noServer: true });
    useServer(
      {
        execute: (args) => (args.rootValue as Enveloped).execute(args) as never,
        subscribe: (args) => (args.rootValue as Enveloped).subscribe(args) as never,
        onSubscribe: async (context, _id, params) => {
          // The plugins read a socket's request headers from the handshake, as they read them from
          // an HTTP request.
          const { schema, execute, subscribe, contextFactory, parse, validate } =
            server.getEnveloped({ ...context, request: handshakeRequest(context.extra.request) });
          const args = {
            schema,
            operationName: params.operationName,
            document: parse(params.query),
            variableValues: params.variables,
            contextValue: await contextFactory(),
            rootValue: { execute, subscribe },
          };
          const errors = validate(args.schema, args.document);
          return errors.length > 0 ? errors : args;
        },
      },
      sockets,
    );
    const httpServer: Server = this.httpAdapterHost.httpAdapter.getHttpServer();
    // With an upgrade listener, Node hands every upgrade request to it and no longer to Express, so
    // the listener answers each other path itself. It closes the socket once the answer is written,
    // as ws does when it refuses a handshake.
    httpServer.on('upgrade', (request, socket, head) => {
      if (new URL(request.url ?? '/', 'http://localhost').pathname !== GRAPHQL_PATH) {
        socket.once('finish', () => socket.destroy());
        socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        return;
      }
      sockets.handleUpgrade(request, socket, head, (webSocket) => {
        sockets.emit('connection', webSocket, request);
      });
    });
    return sockets;
  }
}

/** The handshake of a WebSocket as a fetch Request, the shape the plugins read headers from. */
function handshakeRequest(message: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(message.headers)) {
    for (const one of [value ?? []].flat()) headers.append(name, one);
  }
  return new Request(new URL(message.url ?? GRAPHQL_PATH, 'http://localhost'), { headers });
}
