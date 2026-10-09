// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleServiceModule } from '../../core/article-service.module.ts';
import { ArchiveArticleMutation } from './mutations/archive-article.mutation.ts';
import { CreateArticleMutation } from './mutations/create-article.mutation.ts';
import { RestoreArticleMutation } from './mutations/restore-article.mutation.ts';
import { SetArticlePlantsMutation } from './mutations/set-article-plants.mutation.ts';
import { UpdateArticleMutation } from './mutations/update-article.mutation.ts';
import { UpsertArticleMutation } from './mutations/upsert-article.mutation.ts';
import { articleList } from './queries/article.list.ts';
import { ArticleQueryResolver } from './queries/article.query.resolver.ts';

/** core's GraphQL surface for Article: its queries and the thin mutations of its commands. */
@Module({
  imports: [ArticleServiceModule],
  providers: [
    ArticleQueryResolver,
    articleList.ConnectionResolver,
    CreateArticleMutation,
    UpdateArticleMutation,
    SetArticlePlantsMutation,
    ArchiveArticleMutation,
    RestoreArticleMutation,
    UpsertArticleMutation,
  ],
})
export class ArticleModule {}
