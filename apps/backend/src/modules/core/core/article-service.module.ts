// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleService } from './article.service.ts';
import { ArchiveArticleCommand } from './commands/archive-article.handler.ts';
import { CreateArticleCommand } from './commands/create-article.handler.ts';
import { RestoreArticleCommand } from './commands/restore-article.handler.ts';
import { SetArticlePlantsCommand } from './commands/set-article-plants.handler.ts';
import { UpdateArticleCommand } from './commands/update-article.handler.ts';

/**
 * Provides core's ArticleService and registers the article commands it sends, so boot checks their
 * permissions (ADR 0012): plain providers and no resolvers. core's article surface imports it, and
 * other modules import it through core's public-api.ts (ADR 0003).
 */
@Module({
  providers: [
    ArticleService,
    CreateArticleCommand,
    UpdateArticleCommand,
    SetArticlePlantsCommand,
    ArchiveArticleCommand,
    RestoreArticleCommand,
  ],
  exports: [ArticleService],
})
export class ArticleServiceModule {}
