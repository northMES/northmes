// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import type { ArticleRecord } from '../../../core/article.service.ts';
import {
  type ArticleGroupRecord,
  ArticleGroupService,
} from '../../../core/article-group.service.ts';
import { ArticleGroup } from '../../article-group/types/article-group.type.ts';
import { Article } from '../types/article.type.ts';

/** The fields of Article that read another entity. */
@Resolver(() => Article)
export class ArticleFieldResolver {
  constructor(@Inject(ArticleGroupService) private readonly groups: ArticleGroupService) {}

  /**
   * The article group the article picked, also an archived one, or null. The request's
   * core.articleGroup loader reads the groups of every article in a list with one query.
   */
  @ResolveField(() => ArticleGroup, { nullable: true })
  async articleGroup(
    @Parent() article: ArticleRecord,
    @Context() context: RequestContext,
  ): Promise<ArticleGroupRecord | null> {
    if (article.articleGroup === null) return null;
    return loaderFor(context, 'core.articleGroup', (ids: readonly string[]) =>
      this.groups.byIds(ids),
    ).load(article.articleGroup.id);
  }
}
