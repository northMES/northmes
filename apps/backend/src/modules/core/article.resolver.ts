// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { type ArticleRecord, ArticleService } from './api/article.service.ts';
import { Article } from './api/article.type.ts';

@Resolver(() => Article)
export class ArticleResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** The article with this id at the request's plant, or null. */
  @Query(() => Article, { nullable: true })
  coreArticle(@Args('id', { type: () => ID }) id: string): Promise<ArticleRecord | null> {
    return this.articles.byId(id);
  }
}
