import { type DynamicModule, Global, Inject, Injectable, Module, type Type } from "@nestjs/common";
import { AbstractGraphQLDriver, GraphQLFederationFactory, GraphQLModule, type GqlModuleOptions } from "@nestjs/graphql";
import { printSubgraphSchema } from "@apollo/subgraph";
import type { GraphQLSchema } from "graphql";
import { entityRefs } from "./types.js";

/** Nest 14 links federation v2.14 by default; @theguild/federation-composition 0.27.0 knows up to v2.9. */
export const FEDERATION_LINK = {
  version: 2 as const,
  importUrl: "https://specs.apollo.dev/federation/v2.9",
  directives: ["@key", "@shareable", "@external", "@requires", "@provides", "@inaccessible", "@tag", "@override", "@interfaceObject"],
};

export interface SubgraphEntry {
  name: string;
  schema: GraphQLSchema;
  sdl: string;
  url: string;
  refTypes?: string[];
}

@Injectable()
export class SubgraphRegistry {
  private readonly entries = new Map<string, SubgraphEntry>();
  add(entry: SubgraphEntry) {
    if (this.entries.has(entry.name)) throw new Error(`Subgraph "${entry.name}" registered twice`);
    this.entries.set(entry.name, entry);
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

/** Builds the federated subgraph schema and starts no server; the embedded gateway executes it in process. */
@Injectable()
export class InProcessSubgraphDriver extends AbstractGraphQLDriver<InProcessOptions> {
  constructor(
    @Inject(GraphQLFederationFactory) private readonly federationFactory: GraphQLFederationFactory,
    @Inject(SubgraphRegistry) private readonly registry: SubgraphRegistry,
  ) {
    super();
  }
  override async mergeDefaultOptions(options: InProcessOptions): Promise<InProcessOptions> {
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
  override subscriptionWithFilter(
    instanceRef: unknown,
    filterFn: (payload: any, variables: any, context: any) => boolean | Promise<boolean>,
    createSubscribeContext: Function,
  ) {
    return async (...args: any[]) => {
      const source: AsyncIterable<unknown> = await createSubscribeContext()(...args);
      return (async function* () {
        for await (const payload of source) {
          if (await filterFn.call(instanceRef, payload, args[1], args[2])) yield payload;
        }
      })();
    };
  }
}

export interface DefineSubgraphOptions {
  /** Subgraph name = module gql name = root field prefix. */
  name: string;
  module: Type;
  subscriptions?: boolean;
}

/** Called by the host for every module with a server part; module authors never configure GraphQLModule. */
export function defineSubgraph(o: DefineSubgraphOptions): DynamicModule {
  const orphanedTypes = entityRefs.filter((r) => r.registerIn() === o.module).map((r) => r.type);
  return GraphQLModule.forRoot<InProcessOptions>({
    driver: InProcessSubgraphDriver,
    subgraphName: o.name,
    include: [o.module],
    autoSchemaFile: { federation: FEDERATION_LINK } as any,
    sortSchema: true,
    fieldResolverEnhancers: ["guards", "interceptors", "filters"],
    // @nestjs/graphql 14.0.3 ignores registerIn under federation unless includeModules is passed.
    buildSchemaOptions: { includeModules: [o.module], orphanedTypes } as Record<string, unknown>,
  });
}
