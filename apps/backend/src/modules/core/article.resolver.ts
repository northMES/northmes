// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import type { Connection } from '@northmes/sdk/lists';
import { type ArticleRecord, ArticleService } from './api/article.service.ts';
import { Article } from './api/article.type.ts';
import { type ArticleListArgs, articleList } from './api/article-list.ts';

@Resolver(() => Article)
export class ArticleResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** The article with this id at the request's plant, or null. */
  @Query(() => Article, { nullable: true })
  coreArticle(@Args('id', { type: () => ID }) id: string): Promise<ArticleRecord | null> {
    return this.articles.byId(id);
  }

  /** One page of the articles at the request's plant, with search, orderBy and paging. */
  @Query(() => articleList.Connection)
  coreArticles(
    @Args({ type: () => articleList.Args }) args: ArticleListArgs,
  ): Promise<Connection<ArticleRecord>> {
    return this.articles.list(args);
  }
}
