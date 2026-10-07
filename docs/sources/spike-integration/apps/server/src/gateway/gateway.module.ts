import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { type BeforeApplicationShutdown, Inject, Injectable, type MiddlewareConsumer, Module, type NestModule, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { createGatewayRuntime, type GatewayPlugin, type GatewayRuntime, getGraphQLWSOptions } from "@graphql-hive/gateway-runtime";
import { createDefaultExecutor, type Executor, type Transport } from "@graphql-mesh/transport-common";
import { useServer } from "graphql-ws/use/ws";
import { WebSocketServer } from "ws";
import { type SubgraphContext, type SubgraphEntry, SubgraphRegistry } from "@northmes/sdk";
import { composeSupergraph } from "./compose.js";
import { resolvePrincipal } from "./sessions.js";
import { createHash } from "node:crypto";

export const GATEWAY_PATH = "/graphql";

const principalPlugin: GatewayPlugin = {
  onContextBuilding({ context, extendContext }: any) {
    const req = context.req as IncomingMessage | undefined;
    const cookie = context.request?.headers?.get?.("cookie") ?? req?.headers?.cookie;
    const plant = context.request?.headers?.get?.("x-northmes-plant") ?? (req?.headers?.["x-northmes-plant"] as string | undefined) ?? context.connectionParams?.plantId;
    extendContext({ principal: resolvePrincipal(cookie, plant), requestId: randomUUID() });
  },
};

function inProcessExecutor(entry: SubgraphEntry): Executor {
  const exec = createDefaultExecutor(entry.schema);
  const perRequest = new WeakMap<object, SubgraphContext>();
  return (request) => {
    const gw = (request.context ?? {}) as any;
    let ctx = perRequest.get(gw);
    if (!ctx) {
      ctx = { principal: gw.principal ?? null, requestId: gw.requestId ?? "none", loaders: new Map(), subgraph: entry.name };
      if (request.context) perRequest.set(gw, ctx);
    }
    return exec({ ...request, context: ctx });
  };
}

@Injectable()
export class GatewayService implements OnApplicationBootstrap, BeforeApplicationShutdown, OnApplicationShutdown {
  runtime?: GatewayRuntime;
  supergraphSdl?: string;
  supergraphHash?: string;
  composeMs?: number;
  private wss?: WebSocketServer;
  private wsDisposable?: { dispose(): void | Promise<void> };

  constructor(
    @Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry,
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
  ) {}

  async onApplicationBootstrap() {
    const subgraphs = this.registry.all();
    const t0 = performance.now();
    this.supergraphSdl = composeSupergraph(subgraphs); // throws SupergraphCompositionError: boot fails
    this.composeMs = performance.now() - t0;
    this.supergraphHash = createHash("sha256").update(this.supergraphSdl).digest("hex").slice(0, 12);
    const byName = new Map(subgraphs.map((s) => [s.name, s]));
    const inproc: Transport = {
      getSubgraphExecutor(opts) {
        const entry = byName.get(opts.subgraphName);
        if (!entry) throw new Error(`no in-process subgraph ${opts.subgraphName}`);
        return inProcessExecutor(entry);
      },
    };
    this.runtime = createGatewayRuntime({
      supergraph: this.supergraphSdl,
      graphqlEndpoint: GATEWAY_PATH,
      landingPage: false,
      maskedErrors: true,
      graphiql: false,
      transports: { http: inproc } as any,
      plugins: () => [principalPlugin],
    });
    await this.runtime.getSchema();
    const server = this.adapterHost.httpAdapter.getHttpServer();
    this.wss = new WebSocketServer({ noServer: true });
    // Keep the disposable: dispose() closes every client with 1001 Going away; wss.close() alone does not.
    this.wsDisposable = useServer(getGraphQLWSOptions(this.runtime, (ctx: any) => ({ req: ctx.extra?.request, socket: ctx.extra?.socket, connectionParams: ctx.connectionParams })) as any, this.wss);
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (new URL(req.url ?? "/", "http://x").pathname !== GATEWAY_PATH) return;
      this.wss!.handleUpgrade(req, socket, head, (ws) => this.wss!.emit("connection", ws, req));
    });
  }

  /**
   * Runs before Nest closes the HTTP server. server.close() waits for upgraded WebSocket sockets,
   * so graphql-ws must close its clients (1001 Going away) here or shutdown deadlocks.
   */
  async beforeApplicationShutdown() {
    if (process.env.SPIKE_WS_DISPOSE !== "late") await this.wsDisposable?.dispose();
  }

  async onApplicationShutdown() {
    if (process.env.SPIKE_WS_DISPOSE === "late") await this.wsDisposable?.dispose();
    this.wss?.close();
    await this.runtime?.[Symbol.asyncDispose]?.();
  }

}

@Module({ providers: [GatewayService], exports: [GatewayService] })
export class GatewayModule implements NestModule {
  constructor(@Inject(GatewayService) private readonly gateway: GatewayService) {}
  configure(consumer: MiddlewareConsumer) {
    const gateway = this.gateway;
    consumer
      .apply((req: any, res: any) => (gateway.runtime ? (gateway.runtime as any)(req, res) : res.status(503).end("gateway not ready")))
      .forRoutes(GATEWAY_PATH);
  }
}
