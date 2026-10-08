// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { articleList } from './api/article-list.ts';
import { CoreApiModule } from './api/core-api.module.ts';
import { ArticleResolver } from './article.resolver.ts';
import { CreateArticle } from './commands/create-article.ts';
import { UpdateArticle } from './commands/update-article.ts';

/**
 * The Nest module of core's server entry: its resolvers and its commands, on top of its own API
 * module (ADR 0003, ADR 0012).
 */
@Module({
  imports: [CoreApiModule],
  providers: [ArticleResolver, articleList.ConnectionResolver, CreateArticle, UpdateArticle],
})
export class CoreModule {}
