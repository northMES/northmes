// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleServiceModule } from '../../core/article-service.module.ts';
import { CreateArticle } from './mutations/create-article.mutation.ts';
import { UpdateArticle } from './mutations/update-article.mutation.ts';
import { articleList } from './queries/article.list.ts';
import { ArticleQueryResolver } from './queries/article.query.resolver.ts';

/** core's GraphQL surface for Article: its queries and the mutations of its commands. */
@Module({
  imports: [ArticleServiceModule],
  providers: [ArticleQueryResolver, articleList.ConnectionResolver, CreateArticle, UpdateArticle],
})
export class ArticleModule {}
