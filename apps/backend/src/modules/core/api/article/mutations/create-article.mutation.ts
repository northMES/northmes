// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { createArticle } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/** The input type of the mutation, registered when the module loads. */
const CreateArticleInput = commandInput(createArticle);

/**
 * The mutation coreCreateArticle, whose input type the SDK builds from the contract of
 * core.createArticle. It calls ArticleService.create, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class CreateArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /**
   * Creates an article. A user at a plant creates it for that plant, and in company settings for no
   * plant of the company that companyId names, or for the plants or All plants that the input
   * names.
   */
  @Mutation(() => Article)
  @PlantFree()
  coreCreateArticle(
    @Args('input', { type: () => CreateArticleInput }) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.create(input);
  }
}
