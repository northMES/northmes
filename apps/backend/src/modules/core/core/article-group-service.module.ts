// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { ArticleGroupService } from './article-group.service.ts';
import { ArchiveArticleGroupCommand } from './commands/archive-article-group.handler.ts';
import { CreateArticleGroupCommand } from './commands/create-article-group.handler.ts';
import { RestoreArticleGroupCommand } from './commands/restore-article-group.handler.ts';
import { UpdateArticleGroupCommand } from './commands/update-article-group.handler.ts';

/**
 * Provides core's ArticleGroupService and registers the article group commands it sends, so boot
 * checks their permissions (ADR 0012).
 */
@Module({
  providers: [
    ArticleGroupService,
    CreateArticleGroupCommand,
    UpdateArticleGroupCommand,
    ArchiveArticleGroupCommand,
    RestoreArticleGroupCommand,
  ],
  exports: [ArticleGroupService],
})
export class ArticleGroupServiceModule {}
