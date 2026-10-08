// SPDX-License-Identifier: MIT
// Fixture module catalog: owns Article and reads the articles of a list of ids through a loader.
import { Inject, Injectable, Module } from '@nestjs/common';
import { Args, Context, Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import { GraphQLError } from 'graphql';

@ObjectType('Article')
export class Article {
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
}

/** The catalog's article store. It records every batch it serves. */
@Injectable()
export class CatalogArticles {
  readonly batches: string[][] = [];
  readonly #rows = new Map<string, Article>([
    ['a-1', { id: 'a-1', name: 'Hex bolt M8' }],
    ['a-2', { id: 'a-2', name: 'Flat washer 8' }],
    ['a-3', { id: 'a-3', name: 'Lock nut M8' }],
  ]);

  /** Stores a new row, so a value cached before the rename keeps the old name. */
  rename(id: string, name: string): void {
    this.#rows.set(id, { id, name });
  }

  byId(id: string): Article | undefined {
    return this.#rows.get(id);
  }

  /** One entry per id: the article, or a NOT_FOUND error for an id the catalog does not hold. */
  async byIds(ids: readonly string[]): Promise<(Article | GraphQLError)[]> {
    this.batches.push([...ids]);
    return ids.map(
      (id) =>
        this.#rows.get(id) ??
        new GraphQLError(`Article ${id} was not found`, {
          extensions: { code: 'NOT_FOUND', errorCode: 'catalog.article.not_found' },
        }),
    );
  }
}

@Resolver(() => Article)
export class ArticleResolver {
  constructor(@Inject(CatalogArticles) private readonly articles: CatalogArticles) {}

  @Query(() => Article, { nullable: true })
  catalogArticle(@Args('id', { type: () => ID }) id: string): Article | undefined {
    return this.articles.byId(id);
  }

  /** The articles with these ids, each loaded through the request's catalog.article loader. */
  @Query(() => [Article], { nullable: 'items' })
  catalogArticles(
    @Args('ids', { type: () => [ID] }) ids: string[],
    @Context() context: RequestContext,
  ): Promise<Article>[] {
    const loader = loaderFor(context, 'catalog.article', (keys: readonly string[]) =>
      this.articles.byIds(keys),
    );
    return ids.map((id) => loader.load(id));
  }
}

@Module({ providers: [CatalogArticles, ArticleResolver] })
export class CatalogModule {}
