import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import pg from "pg";
import {
  Args,
  Context,
  Directive,
  Field,
  ID,
  Int,
  ObjectType,
  Parent,
  Query,
  registerEnumType,
  ResolveReference,
  Resolver,
} from "@nestjs/graphql";
import { connectionOf, toConnection } from "../../sdk/types.js";
import { Public, RequirePermission } from "../../sdk/permission.js";
import { loaderFor, type SubgraphContext } from "../../sdk/context.js";
import { batchLoader } from "../../sdk/loader.js";

export enum ArticleStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}
registerEnumType(ArticleStatus, { name: "ArticleStatus", registerIn: () => CoreModule });

@ObjectType("Article", { registerIn: () => CoreModule })
@Directive('@key(fields: "id")')
export class Article {
  @Field(() => ID) id: string;
  @Field(() => String) code: string;
  @Field(() => String) name: string;
  @Field(() => ArticleStatus) status: ArticleStatus;
}

const ArticleConnection = connectionOf(Article, "Article", () => CoreModule);

/** Stand-in for the core article repository (company-level master data). */
@Injectable()
export class ArticleRepo implements OnModuleDestroy {
  /** Set when DATABASE_URL is present (Testcontainers test); otherwise in-memory rows. */
  private readonly pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 }) : null;
  sqlQueries = 0;
  async onModuleDestroy() {
    await this.pool?.end();
  }
  readonly rows: Article[] = [
    { id: "a1", code: "TT-100", name: "Table top", status: ArticleStatus.ACTIVE },
    { id: "a2", code: "LG-200", name: "Leg", status: ArticleStatus.ACTIVE },
    { id: "a3", code: "OLD-1", name: "Old article", status: ArticleStatus.ARCHIVED },
  ];
  batchCalls = 0;
  async byIds(ids: readonly string[]): Promise<(Article | null)[]> {
    this.batchCalls++;
    if (this.pool) {
      this.sqlQueries++;
      const { rows } = await this.pool.query<Article>(
        "select id, code, name, status from core.article where id = any($1::text[])",
        [ids],
      );
      return ids.map((id) => rows.find((r) => r.id === id) ?? null);
    }
    return ids.map((id) => this.rows.find((r) => r.id === id) ?? null);
  }
}

@Resolver(() => Article)
@RequirePermission("core.article:read")
export class ArticleResolver {
  constructor(@Inject(ArticleRepo) private readonly repo: ArticleRepo) {}

  @Query(() => Article, { nullable: true })
  coreArticle(@Args("id", { type: () => ID }) id: string, @Context() ctx: SubgraphContext) {
    return this.loader(ctx).load(id);
  }

  @Query(() => ArticleConnection)
  coreArticles(@Args("first", { type: () => Int, defaultValue: 25 }) first: number) {
    return toConnection(this.repo.rows, Math.min(first, 100));
  }

  /**
   * Called once per representation by @apollo/subgraph; the loader batches
   * them into one repository call. Returns null (never undefined) for unknown ids.
   */
  /** Throws a plain Error, to check what the gateway lets through to clients. */
  @Query(() => String, { nullable: true })
  @Public()
  coreBoom(): string {
    throw new Error("internal detail: password=hunter2");
  }

  @ResolveReference()
  async resolveReference(@Parent() ref: { __typename: string; id: string }, @Context() ctx: SubgraphContext) {
    const found = await this.loader(ctx).load(ref.id);
    if (process.env.SPIKE_UNDEFINED_REFERENCE === "1") return found ?? undefined;
    return found;
  }

  private loader(ctx: SubgraphContext) {
    return loaderFor(ctx, "core.article", () => batchLoader((ids: readonly string[]) => this.repo.byIds(ids)));
  }
}

@Module({ providers: [ArticleRepo, ArticleResolver], exports: [ArticleRepo] })
export class CoreModule {}
