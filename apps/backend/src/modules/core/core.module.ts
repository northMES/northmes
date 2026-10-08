// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { articleList } from './api/article-list.ts';
import { CoreApiModule } from './api/core-api.module.ts';
import { ArticleResolver } from './article.resolver.ts';

/** The Nest module of core's server entry: its resolvers, on top of its own API module (ADR 0003). */
@Module({ imports: [CoreApiModule], providers: [ArticleResolver, articleList.ConnectionResolver] })
export class CoreModule {}
