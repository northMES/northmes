// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleGroupServiceModule } from '../../core/article-group-service.module.ts';
import { ArticleGroupOperations } from './article-group.operations.ts';
import { ArchiveArticleGroupMutation } from './mutations/archive-article-group.mutation.ts';
import { CreateArticleGroupMutation } from './mutations/create-article-group.mutation.ts';
import { RestoreArticleGroupMutation } from './mutations/restore-article-group.mutation.ts';
import { UpdateArticleGroupMutation } from './mutations/update-article-group.mutation.ts';
import { articleGroupList } from './queries/article-group.list.ts';
import { ArticleGroupQueryResolver } from './queries/article-group.query.resolver.ts';

/**
 * core's surfaces for ArticleGroup: its GraphQL queries, the thin mutations of its commands and
 * its operations, which the operation runner serves (ADR 0073).
 */
@Module({
  imports: [ArticleGroupServiceModule],
  providers: [
    ArticleGroupQueryResolver,
    articleGroupList.ConnectionResolver,
    CreateArticleGroupMutation,
    UpdateArticleGroupMutation,
    ArchiveArticleGroupMutation,
    RestoreArticleGroupMutation,
    ArticleGroupOperations,
  ],
})
export class ArticleGroupModule {}
