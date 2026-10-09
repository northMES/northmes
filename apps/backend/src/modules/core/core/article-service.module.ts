// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleService } from './article.service.ts';

/**
 * Provides core's ArticleService: plain providers and no resolvers. core's article surface imports
 * it, and other modules import it through core's public-api.ts (ADR 0003).
 */
@Module({ providers: [ArticleService], exports: [ArticleService] })
export class ArticleServiceModule {}
