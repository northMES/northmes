// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { restoreArticle } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/** The input type of the mutation, registered when the module loads. */
const RestoreArticleInput = commandInput(restoreArticle);

/**
 * The mutation coreRestoreArticle, whose input type the SDK builds from the contract of
 * core.restoreArticle. It calls ArticleService.restore, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class RestoreArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** Restores an archived article. */
  @Mutation(() => Article)
  @PlantFree()
  coreRestoreArticle(
    @Args('input', { type: () => RestoreArticleInput }) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.restore(input);
  }
}
