// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { setArticlePlants } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/** The input type of the mutation, registered when the module loads. */
const SetArticlePlantsInput = commandInput(setArticlePlants);

/**
 * The mutation coreSetArticlePlants, whose input type the SDK builds from the contract of
 * core.setArticlePlants. It calls ArticleService.setPlants, which sends the command through the
 * command bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class SetArticlePlantsMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** Replaces the plants an article is assigned to, or assigns it to All plants. */
  @Mutation(() => Article)
  coreSetArticlePlants(
    @Args('input', { type: () => SetArticlePlantsInput }) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.setPlants(input);
  }
}
