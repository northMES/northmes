// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import type { Connection } from '@northmes/sdk/lists';
import {
  type ArticleGroupRecord,
  ArticleGroupService,
} from '../../../core/article-group.service.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { ArticleGroup } from '../types/article-group.type.ts';
import { type ArticleGroupListArgs, articleGroupList } from './article-group.list.ts';

/**
 * core's queries on ArticleGroup. Each needs core.articleGroup:read at the request's plant, or in
 * company settings at the company the request names (ADR 0066).
 */
@Resolver(() => ArticleGroup)
export class ArticleGroupQueryResolver {
  constructor(@Inject(ArticleGroupService) private readonly groups: ArticleGroupService) {}

  /** The article group with this id among the company's, or null. */
  @Query(() => ArticleGroup, { nullable: true })
  @PlantFree()
  coreArticleGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<ArticleGroupRecord | null> {
    return this.groups.byId(id, companyId ?? undefined);
  }

  /** One page of the company's article groups, with search, orderBy and paging. */
  @Query(() => articleGroupList.Connection)
  @PlantFree()
  coreArticleGroups(
    @Args({ type: () => articleGroupList.Args }) args: ArticleGroupListArgs,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<Connection<ArticleGroupRecord>> {
    return this.groups.list(args, companyId ?? undefined);
  }
}
