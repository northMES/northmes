// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleService } from './article.service.ts';

/**
 * Core's public service API: plain providers and no resolvers (ADR 0003). Other modules import
 * it through core's api/index.ts.
 */
@Module({ providers: [ArticleService], exports: [ArticleService] })
export class CoreApiModule {}
