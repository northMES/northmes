// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import type { Connection } from '@northmes/sdk/lists';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { Article } from '../types/article.type.ts';
import { type ArticleListArgs, articleList } from './article.list.ts';

/**
 * core's queries on Article. Each needs core.article:read at the request's plant, or in company
 * settings at the company the request names (ADR 0066, ADR 0073).
 */
@Resolver(() => Article)
export class ArticleQueryResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /**
   * The article with this id among the articles of the company, or null, also one that is not
   * assigned to the request's plant.
   */
  @Query(() => Article, { nullable: true })
  @PlantFree()
  coreArticle(
    @Args('id', { type: () => ID }) id: string,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<ArticleRecord | null> {
    return this.articles.byId(id, companyId ?? undefined);
  }

  /**
   * One page of the articles, with search, orderBy and paging: at a plant, those assigned to it or
   * to All plants; in company settings, every article of the company.
   */
  @Query(() => articleList.Connection)
  @PlantFree()
  coreArticles(
    @Args({ type: () => articleList.Args }) args: ArticleListArgs,
    @Args('companyId', companyIdArg) companyId?: string | null,
    @Args('unassigned', {
      type: () => Boolean,
      nullable: true,
      description: 'Only the articles assigned to no plant and not to All plants.',
    })
    unassigned?: boolean | null,
  ): Promise<Connection<ArticleRecord>> {
    return this.articles.list(args, {
      companyId: companyId ?? undefined,
      unassigned: unassigned ?? undefined,
    });
  }
}
