// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import type { StockUnitCode } from '@northmes/contracts';
import { PlantFree } from '@northmes/sdk/graphql';
import type { Connection } from '@northmes/sdk/lists';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { Article, StockUnit } from '../types/article.type.ts';
import { ArticleFacets } from '../types/article-facets.type.ts';
import { type ArticleListArgs, articleList } from './article.list.ts';

/** The articles of any of these groups; a null element keeps the articles of no group. */
const articleGroupIdsArg = {
  type: () => [ID],
  nullable: 'itemsAndList',
  description: 'Only the articles of these groups; a null element keeps those of no group.',
} as const;

/** The articles that count in any of these stock units. */
const stockUnitsArg = {
  type: () => [StockUnit],
  nullable: true,
  description: 'Only the articles that count in these stock units.',
} as const;

/** The articles from any of these sources; a null element keeps those created in NorthMES. */
const sourcesArg = {
  type: () => [String],
  nullable: 'itemsAndList',
  description: 'Only the articles from these sources; a null element keeps those from NorthMES.',
} as const;

/**
 * core's queries on Article. Each needs core.article:read at the request's plant, or in company
 * settings at the company the request names (ADR 0066, ADR 0073).
 */
@Resolver(() => Article)
export class ArticleQueryResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  @Query(() => Article, {
    nullable: true,
    description:
      "The article with this id among the articles of the company, or null, also one that is not assigned to the request's plant. Needs core.article:read.",
  })
  @PlantFree()
  coreArticle(
    @Args('id', { type: () => ID, description: "The article's id." }) id: string,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<ArticleRecord | null> {
    return this.articles.byId(id, companyId ?? undefined);
  }

  @Query(() => articleList.Connection, {
    description:
      'One page of the articles, with search, orderBy, filters and paging: at a plant, those assigned to it or to All plants; in company settings, every article of the company. Needs core.article:read.',
  })
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
    @Args('articleGroupIds', articleGroupIdsArg) articleGroupIds?: (string | null)[] | null,
    @Args('stockUnits', stockUnitsArg) stockUnits?: StockUnitCode[] | null,
    @Args('sources', sourcesArg) sources?: (string | null)[] | null,
  ): Promise<Connection<ArticleRecord>> {
    return this.articles.list(args, {
      companyId: companyId ?? undefined,
      unassigned: unassigned ?? undefined,
      articleGroupIds: articleGroupIds ?? undefined,
      stockUnits: stockUnits ?? undefined,
      sources: sources ?? undefined,
    });
  }

  /** Each field is counted under the others' filters but not its own (design ui-222, LI3). */
  @Query(() => ArticleFacets, {
    description:
      "The values of the articles list's filter fields with how many articles have each, for the same search, archived rows and filters as coreArticles. Needs core.article:read.",
  })
  @PlantFree()
  async coreArticleFacets(
    @Args('companyId', companyIdArg) companyId?: string | null,
    @Args('search', {
      type: () => String,
      nullable: true,
      description: 'The search of coreArticles: only the articles whose text contains this.',
    })
    search?: string | null,
    @Args('includeArchived', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
      description: 'Counts archived articles too.',
    })
    includeArchived?: boolean | null,
    @Args('articleGroupIds', articleGroupIdsArg) articleGroupIds?: (string | null)[] | null,
    @Args('stockUnits', stockUnitsArg) stockUnits?: StockUnitCode[] | null,
    @Args('sources', sourcesArg) sources?: (string | null)[] | null,
  ): Promise<ArticleFacets> {
    const facets = await this.articles.facets({
      companyId: companyId ?? undefined,
      search,
      includeArchived,
      articleGroupIds: articleGroupIds ?? undefined,
      stockUnits: stockUnits ?? undefined,
      sources: sources ?? undefined,
    });
    return {
      total: facets.total,
      articleGroups: facets.articleGroups.map(({ value, count }) => ({
        id: value?.id ?? null,
        code: value?.code ?? null,
        name: value?.name ?? null,
        count,
      })),
      stockUnits: facets.stockUnits.map(({ value, count }) => ({ stockUnit: value, count })),
      sources: facets.sources.map(({ value, count }) => ({ source: value, count })),
    };
  }
}
