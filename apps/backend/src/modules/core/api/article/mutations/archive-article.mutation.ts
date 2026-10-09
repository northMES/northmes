// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { archiveArticle } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/** The input type of the mutation, registered when the module loads. */
const ArchiveArticleInput = commandInput(archiveArticle);

/**
 * The mutation coreArchiveArticle, whose input type the SDK builds from the contract of
 * core.archiveArticle. It calls ArticleService.archive, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class ArchiveArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** Archives an article at every plant. */
  @Mutation(() => Article)
  @PlantFree()
  coreArchiveArticle(
    @Args('input', { type: () => ArchiveArticleInput }) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.archive(input);
  }
}
