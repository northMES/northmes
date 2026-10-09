// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleModule } from './api/article/article.module.ts';

/**
 * The core module's Nest module, which AppModule imports: one module per entity of its GraphQL
 * surface (ADR 0070).
 */
@Module({ imports: [ArticleModule] })
export class CoreModule {}
