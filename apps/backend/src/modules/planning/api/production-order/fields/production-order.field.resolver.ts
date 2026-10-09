// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import { Article, type ArticleRecord, ArticleService } from '../../../../core/public-api.ts';
import type { ProductionOrderRecord } from '../../../core/production-order.service.ts';
import { ProductionOrder } from '../types/production-order.type.ts';

/** The fields of ProductionOrder that read another module. */
@Resolver(() => ProductionOrder)
export class ProductionOrderFieldResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /**
   * The article the order makes, or null when core has none at the request's scopes. The request's
   * core.article loader reads the articles of every order in a list with one query of core's
   * ArticleService.
   */
  @ResolveField(() => Article, { nullable: true })
  article(
    @Parent() order: ProductionOrderRecord,
    @Context() context: RequestContext,
  ): Promise<ArticleRecord | null> {
    return loaderFor(context, 'core.article', (ids: readonly string[]) =>
      this.articles.byIds(ids),
    ).load(order.articleId);
  }
}
