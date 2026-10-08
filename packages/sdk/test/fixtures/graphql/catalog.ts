// SPDX-License-Identifier: MIT
// Fixture module catalog: owns the entity Article and resolves references to it.
import { Inject, Injectable, Module } from '@nestjs/common';
import {
  Args,
  Context,
  Directive,
  Field,
  ID,
  ObjectType,
  Parent,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { type EntityReference, loaderFor, type SubgraphContext } from '@northmes/sdk/graphql';

@ObjectType('Article', { registerIn: () => CatalogModule })
@Directive('@key(fields: "id")')
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

  async byIds(ids: readonly string[]): Promise<(Article | undefined)[]> {
    this.batches.push([...ids]);
    return ids.map((id) => this.#rows.get(id));
  }
}

@Resolver(() => Article)
export class ArticleResolver {
  constructor(@Inject(CatalogArticles) private readonly articles: CatalogArticles) {}

  @Query(() => Article, { nullable: true })
  catalogArticle(@Args('id', { type: () => ID }) id: string): Article | undefined {
    return this.articles.byId(id);
  }

  @ResolveReference()
  resolveReference(
    @Parent() reference: EntityReference,
    @Context() context: SubgraphContext,
  ): Promise<Article | undefined> {
    return loaderFor(context, 'catalog.article', (ids: readonly string[]) =>
      this.articles.byIds(ids),
    ).load(reference.id);
  }
}

@Module({ providers: [CatalogArticles, ArticleResolver] })
export class CatalogModule {}
