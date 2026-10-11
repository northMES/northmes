// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { upsertArticle } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/** The input type of the mutation, registered when the module loads. */
const UpsertArticleInput = commandInput(upsertArticle);

/**
 * The mutation coreUpsertArticle, whose input type the SDK builds from the contract of
 * core.upsertArticle. It calls ArticleService.upsertByCode, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class UpsertArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /**
   * Creates the article with the input's article number, or renames it and changes its plants,
   * for an ERP that pushes its articles. A user at a plant upserts there, and in company settings
   * at the company that companyId names.
   */
  @Mutation(() => Article)
  @PlantFree()
  coreUpsertArticle(
    @Args('input', { type: () => UpsertArticleInput }) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.upsertByCode(input);
  }
}
