import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  Inject,
  Injectable,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { HttpAdapterHost, ModulesContainer } from "@nestjs/core";
import { GRAPHQL_MODULE_OPTIONS, GraphQLModule, GraphQLSchemaHost } from "@nestjs/graphql";
import { printSubgraphSchema } from "@apollo/subgraph";
import {
  createGatewayRuntime,
  type GatewayPlugin,
  type GatewayRuntime,
  getGraphQLWSOptions,
} from "@graphql-hive/gateway-runtime";
import { createDefaultExecutor, type Executor, type Transport } from "@graphql-mesh/transport-common";
import httpTransport from "@graphql-mesh/transport-http";
import wsTransport from "@graphql-mesh/transport-ws";
import { useServer } from "graphql-ws/use/ws";
import { print } from "graphql";
import { WebSocketServer } from "ws";
import type { SubgraphContext } from "../sdk/context.js";
import {
  PRINCIPAL_HEADER,
  signPrincipal,
  type SubgraphEntry,
  SubgraphRegistry,
  subgraphMode,
} from "../sdk/subgraph.js";
import { composeSupergraph } from "./compose.js";
import { resolvePrincipal } from "./sessions.js";

export const GATEWAY_PATH = "/graphql";

/** Gateway-side context additions, computed once per client request. */
const principalPlugin: GatewayPlugin = {
  onContextBuilding({ context, extendContext }: any) {
    const req = context.req as IncomingMessage | undefined;
    const cookie = context.request?.headers?.get?.("cookie") ?? req?.headers?.cookie;
    const plant =
      context.request?.headers?.get?.("x-northmes-plant") ??
      (req?.headers?.["x-northmes-plant"] as string | undefined) ??
      context.connectionParams?.plantId;
    const principal = resolvePrincipal(cookie, plant);
    const requestId = randomUUID();
    extendContext({ principal, requestId, principalHeader: signPrincipal(principal, requestId) });
  },
};

/** Executor that runs the subgraph schema in this process: no HTTP, no serialization. */
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
    const result = exec({ ...request, context: ctx });
    if (process.env.SPIKE_TRACE === "1") {
      Promise.resolve(result).then((r: any) =>
        console.log(`[inproc ${entry.name}]`, print(request.document).replace(/\s+/g, " "), JSON.stringify(request.variables), JSON.stringify(r)?.slice(0, 400)),
      );
    }
    return result;
  };
}

@Injectable()
export class GatewayService implements OnApplicationBootstrap, OnApplicationShutdown {
  runtime?: GatewayRuntime;
  supergraphSdl?: string;
  private wss?: WebSocketServer;

  constructor(
    @Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry,
    @Inject(ModulesContainer) private readonly modules: ModulesContainer,
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
  ) {}

  /** Subgraphs this process serves, whatever the mode. */
  collectSubgraphs(): SubgraphEntry[] {
    if (subgraphMode() === "inproc") return this.registry.all();
    const port = Number(process.env.PORT ?? 4000);
    const out: SubgraphEntry[] = [];
    for (const mod of this.modules.values()) {
      if (mod.metatype !== GraphQLModule) continue;
      const options = mod.providers.get(GRAPHQL_MODULE_OPTIONS)?.instance as { path: string };
      const schema = (mod.providers.get(GraphQLSchemaHost)?.instance as GraphQLSchemaHost).schema;
      const name = options.path.split("/").at(-1)!;
      out.push({ name, schema, sdl: printSubgraphSchema(schema), url: `http://127.0.0.1:${port}${options.path}` });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async onApplicationBootstrap() {
    const subgraphs = this.collectSubgraphs();
    // Throws SupergraphCompositionError: Nest bootstrap fails and the process exits non-zero.
    this.supergraphSdl = composeSupergraph(subgraphs);
    const byName = new Map(subgraphs.map((s) => [s.name, s]));

    const hybridHttp: Transport = {
      getSubgraphExecutor(opts) {
        const entry = byName.get(opts.subgraphName);
        if (entry && opts.transportEntry.location?.startsWith("inproc://")) return inProcessExecutor(entry);
        return httpTransport.getSubgraphExecutor(opts);
      },
    };

    this.runtime = createGatewayRuntime({
      supergraph: this.supergraphSdl,
      graphqlEndpoint: GATEWAY_PATH,
      landingPage: false,
      maskedErrors: process.env.SPIKE_UNMASK === "1" ? false : true,
      graphiql: false,
      transports: { http: hybridHttp, ws: wsTransport } as any,
      transportEntries: {
        "*.http": {
          headers: [[PRINCIPAL_HEADER, "{context.principalHeader}"]],
          options:
            process.env.SPIKE_NO_WS_KIND === "1"
              ? {}
              : {
                  subscriptions: {
                    kind: "ws",
                    options: { connectionParams: { [PRINCIPAL_HEADER]: "{context.principalHeader}" } },
                  },
                },
        },
      } as any,
      plugins: () => [principalPlugin],
    });

    // Load the supergraph now: fails boot on a bad supergraph, and graphql-ws
    // subscriptions before the first HTTP request otherwise see a null schema.
    await this.runtime.getSchema();

    const server = this.adapterHost.httpAdapter.getHttpServer();
    this.wss = new WebSocketServer({ noServer: true });
    useServer(
      getGraphQLWSOptions(this.runtime, (ctx: any) => ({ req: ctx.extra?.request, socket: ctx.extra?.socket, connectionParams: ctx.connectionParams })) as any,
      this.wss,
    );
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (new URL(req.url ?? "/", "http://x").pathname !== GATEWAY_PATH) return;
      this.wss!.handleUpgrade(req, socket, head, (ws) => this.wss!.emit("connection", ws, req));
    });
  }

  async onApplicationShutdown() {
    this.wss?.close();
    await this.runtime?.[Symbol.asyncDispose]?.();
  }
}

@Module({ providers: [GatewayService], exports: [GatewayService] })
export class GatewayModule implements NestModule {
  constructor(@Inject(GatewayService) private readonly gateway: GatewayService) {}

  // Registered before Nest's 404 handler; the runtime exists from onApplicationBootstrap on.
  configure(consumer: MiddlewareConsumer) {
    const gateway = this.gateway;
    consumer
      .apply((req: any, res: any, next: () => void) => {
        if (!gateway.runtime) return res.status(503).end("gateway not ready");
        return (gateway.runtime as any)(req, res);
      })
      .forRoutes(GATEWAY_PATH);
  }
}
