// SPDX-License-Identifier: MIT
// Fixture module catalog: owns the entity Article.
import { Inject, Injectable, Module } from '@nestjs/common';
import { Args, Directive, Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';

@ObjectType('Article', { registerIn: () => CatalogModule })
@Directive('@key(fields: "id")')
export class Article {
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
}

/** The catalog's article store. */
@Injectable()
export class CatalogArticles {
  readonly #rows = new Map<string, Article>([
    ['a-1', { id: 'a-1', name: 'Hex bolt M8' }],
    ['a-2', { id: 'a-2', name: 'Flat washer 8' }],
    ['a-3', { id: 'a-3', name: 'Lock nut M8' }],
  ]);

  byId(id: string): Article | undefined {
    return this.#rows.get(id);
  }
}

@Resolver(() => Article)
export class ArticleResolver {
  constructor(@Inject(CatalogArticles) private readonly articles: CatalogArticles) {}

  @Query(() => Article, { nullable: true })
  catalogArticle(@Args('id', { type: () => ID }) id: string): Article | undefined {
    return this.articles.byId(id);
  }
}

@Module({ providers: [CatalogArticles, ArticleResolver] })
export class CatalogModule {}
