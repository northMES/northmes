import { createHmac, timingSafeEqual } from "node:crypto";
import { type DynamicModule, Global, Inject, Injectable, Module, type Type } from "@nestjs/common";
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from "@nestjs/apollo";
import {
  AbstractGraphQLDriver,
  GraphQLFederationFactory,
  GraphQLModule,
  type GqlModuleOptions,
} from "@nestjs/graphql";
import { printSubgraphSchema } from "@apollo/subgraph";
import type { GraphQLSchema } from "graphql";
import type { Principal, SubgraphContext } from "./context.js";
import { entityRefs } from "./types.js";

/**
 * Nest 14 links federation/v2.14 by default; @theguild/federation-composition
 * 0.27.0 knows v2.0 to v2.9. Pin v2.9 and import only what the SDK supports.
 */
export const FEDERATION_LINK = {
  version: 2 as const,
  importUrl: "https://specs.apollo.dev/federation/v2.9",
  directives: ["@key", "@shareable", "@external", "@requires", "@provides", "@inaccessible", "@tag", "@override", "@interfaceObject"],
};

export type SubgraphMode = "inproc" | "http";
export const subgraphMode = (): SubgraphMode =>
  process.env.SUBGRAPH_MODE === "http" ? "http" : "inproc";

export interface SubgraphEntry {
  name: string;
  schema: GraphQLSchema;
  sdl: string;
  /** Where the gateway reaches it: inproc://name or http://host/path. */
  url: string;
  /** Entity types this subgraph only references by name (entityRef stubs). */
  refTypes?: string[];
}

/** One per process. Filled by the subgraph drivers during module init. */
@Injectable()
export class SubgraphRegistry {
  private readonly entries = new Map<string, SubgraphEntry>();
  add(entry: SubgraphEntry) {
    if (this.entries.has(entry.name)) throw new Error(`Subgraph "${entry.name}" registered twice`);
    this.entries.set(entry.name, entry);
  }
  get(name: string): SubgraphEntry {
    const e = this.entries.get(name);
    if (!e) throw new Error(`Unknown subgraph "${name}"`);
    return e;
  }
  all(): SubgraphEntry[] {
    return [...this.entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

@Global()
@Module({ providers: [SubgraphRegistry], exports: [SubgraphRegistry] })
export class SubgraphRegistryModule {}

interface InProcessOptions extends GqlModuleOptions {
  subgraphName: string;
}

/**
 * A driver that builds the federated subgraph schema (same code path as
 * ApolloFederationDriver.generateSchema) but starts no Apollo Server and mounts
 * no HTTP route. The gateway executes against the schema in process.
 */
@Injectable()
export class InProcessSubgraphDriver extends AbstractGraphQLDriver<InProcessOptions> {
  constructor(
    @Inject(GraphQLFederationFactory) private readonly federationFactory: GraphQLFederationFactory,
    @Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry,
  ) {
    super();
  }

  override async mergeDefaultOptions(options: InProcessOptions): Promise<InProcessOptions> {
    // No path: GraphQLModule then logs no route.
    return { fieldResolverEnhancers: [], ...options, path: undefined } as InProcessOptions;
  }

  override generateSchema(options: InProcessOptions) {
    return this.federationFactory.generateSchema(options);
  }

  async start(options: InProcessOptions): Promise<void> {
    const schema = options.schema as GraphQLSchema;
    const module = (options.include ?? [])[0];
    this.registry.add({
      name: options.subgraphName,
      schema,
      sdl: printSubgraphSchema(schema),
      url: `inproc://${options.subgraphName}`,
      refTypes: entityRefs.filter((r) => r.registerIn() === module).map((r) => (r.type as any).name as string),
    });
  }

  async stop(): Promise<void> {}

  // Same contract as ApolloBaseDriver: wraps the iterator for @Subscription({ filter }).
  override subscriptionWithFilter(
    instanceRef: unknown,
    filterFn: (payload: any, variables: any, context: any) => boolean | Promise<boolean>,
    createSubscribeContext: Function,
  ) {
    return async (...args: any[]) => {
      // Nest's context callback is async (guards run first), so await it; a guard
      // rejection then fails the subscribe call itself, not the first event.
      const source: AsyncIterable<unknown> = await createSubscribeContext()(...args);
      return (async function* () {
        for await (const payload of source) {
          if (await filterFn.call(instanceRef, payload, args[1], args[2])) yield payload;
        }
      })();
    };
  }
}

// ---------------------------------------------------------------------------
// Signed principal header, used only when subgraphs are reached over HTTP.
// ---------------------------------------------------------------------------
const SECRET = process.env.NORTHMES_INTERNAL_SECRET ?? "spike-secret";
export const PRINCIPAL_HEADER = "x-northmes-principal";

export function signPrincipal(p: Principal | null, requestId: string): string {
  const body = Buffer.from(
    JSON.stringify({ p: p && { ...p, permissions: [...p.permissions] }, r: requestId, t: Date.now() }),
  ).toString("base64url");
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyPrincipal(header: string | undefined): { principal: Principal | null; requestId: string } {
  if (!header) return { principal: null, requestId: "none" };
  const [body, mac] = header.split(".");
  const expected = createHmac("sha256", SECRET).update(body ?? "").digest();
  const given = Buffer.from(mac ?? "", "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { principal: null, requestId: "bad-signature" };
  }
  const parsed = JSON.parse(Buffer.from(body!, "base64url").toString());
  if (Date.now() - parsed.t > 30_000) return { principal: null, requestId: "expired" };
  const p = parsed.p;
  return {
    principal: p ? { ...p, permissions: new Set<string>(p.permissions) } : null,
    requestId: parsed.r,
  };
}

// ---------------------------------------------------------------------------
// defineSubgraph: the only GraphQL wiring a module author writes.
// ---------------------------------------------------------------------------
export interface DefineSubgraphOptions {
  /** Subgraph name = module id. Root fields must start with it. */
  name: string;
  /** The Nest module that holds this subgraph's resolvers. */
  module: Type;
  subscriptions?: boolean;
}

const common = (o: DefineSubgraphOptions) => ({
  include: [o.module],
  autoSchemaFile: { federation: process.env.SPIKE_DEFAULT_LINK === "1" ? (2 as const) : FEDERATION_LINK } as any,
  sortSchema: true,
  fieldResolverEnhancers: (process.env.SPIKE_NO_ENHANCERS === "1" ? [] : ["guards", "interceptors", "filters"]) as ("guards" | "interceptors" | "filters")[],
  // Workaround: @nestjs/graphql 14.0.3 passes `include` to the type filter
  // (registerIn) only on the non-federated path. GraphQLFederationFactory spreads
  // buildSchemaOptions into the factory options, so the internal key gets through.
  ...(process.env.SPIKE_NO_INCLUDE_WORKAROUND === "1"
    ? {}
    : { buildSchemaOptions: { includeModules: [o.module] } as Record<string, unknown> }),
  ...{},
});

/** Orphaned entity stubs for this module (types only used as @Resolver parents). */
const orphans = (o: DefineSubgraphOptions) => entityRefs.filter((r) => r.registerIn() === o.module).map((r) => r.type);

const withOrphans = (o: DefineSubgraphOptions) => ({
  ...common(o),
  buildSchemaOptions: { ...(common(o) as any).buildSchemaOptions, orphanedTypes: orphans(o) },
});

/** Nest 14 ApolloFederationDriver per subgraph, mounted on /subgraphs/<name>. Used for comparison. */
function httpSubgraph(o: DefineSubgraphOptions): DynamicModule {
  const path = `/subgraphs/${o.name}`;
  return GraphQLModule.forRoot<ApolloFederationDriverConfig>({
    driver: ApolloFederationDriver,
    path,
    ...withOrphans(o),
    graphiql: false,
    ...(o.subscriptions ? { subscriptions: { "graphql-ws": { path } } } : {}),
    context: ({ req, extra, connectionParams }: { req?: any; connectionParams?: any; extra?: any }): SubgraphContext => {
      const headers = req?.headers ?? extra?.request?.headers ?? {};
      // graphql-ws: the gateway puts the signed principal into connectionParams.
      const fromWs = connectionParams?.[PRINCIPAL_HEADER];
      const { principal, requestId } = verifyPrincipal(headers[PRINCIPAL_HEADER] ?? fromWs);
      return { principal, requestId, loaders: new Map(), subgraph: o.name };
    },
  });
}

export function defineSubgraph(o: DefineSubgraphOptions): DynamicModule {
  if (!/^[a-z][a-zA-Z0-9]*$/.test(o.name)) throw new Error(`Bad subgraph name ${o.name}`);
  if (subgraphMode() === "http") return httpSubgraph(o);
  return GraphQLModule.forRoot<InProcessOptions>({
    driver: InProcessSubgraphDriver,
    subgraphName: o.name,
    ...withOrphans(o),
  });
}
