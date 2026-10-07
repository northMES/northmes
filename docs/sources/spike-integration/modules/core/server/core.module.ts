import { Inject, Module } from "@nestjs/common";
import { Args, Context, Directive, Field, ID, ObjectType, Parent, Query, ResolveReference, Resolver } from "@nestjs/graphql";
import { batchLoader, loaderFor, RequirePermission, type SubgraphContext } from "@northmes/sdk";
import { ArticleService, CoreApiModule } from "./api.js";

@ObjectType("Article", { registerIn: () => CoreModule })
@Directive('@key(fields: "id")')
export class Article {
  @Field(() => ID) id: string;
  @Field(() => String) code: string;
  @Field(() => String) name: string;
}

@Resolver(() => Article)
@RequirePermission("core.article:read")
export class ArticleResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  @Query(() => Article, { nullable: true })
  coreArticle(@Args("id", { type: () => ID }) id: string, @Context() ctx: SubgraphContext) {
    return this.loader(ctx).load(id);
  }

  @ResolveReference()
  resolveReference(@Parent() ref: { id: string }, @Context() ctx: SubgraphContext) {
    return this.loader(ctx).load(ref.id);
  }

  private loader(ctx: SubgraphContext) {
    return loaderFor(ctx, "core.article", () => batchLoader((ids: readonly string[]) => this.articles.byIds(ids)));
  }
}

@Module({ imports: [CoreApiModule], providers: [ArticleResolver], exports: [CoreApiModule] })
export class CoreModule {}
export default CoreModule;
