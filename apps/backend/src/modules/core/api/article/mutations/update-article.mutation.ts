// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { updateArticle } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/** The input type of the mutation, registered when the module loads. */
const UpdateArticleInput = commandInput(updateArticle);

/**
 * The mutation coreUpdateArticle, whose input type the SDK builds from the contract of
 * core.updateArticle. It calls ArticleService.update, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class UpdateArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** Changes an article's code and name. */
  @Mutation(() => Article)
  @PlantFree()
  coreUpdateArticle(
    @Args('input', { type: () => UpdateArticleInput }) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.update(input);
  }
}
