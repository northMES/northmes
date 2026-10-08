// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleService } from './article.service.ts';

/**
 * Core's public service API: plain providers and no resolvers, so a module that imports it adds
 * nothing to its own subgraph (ADR 0003). Other in-repo modules import it through
 * @northmes/module-core/api.
 */
@Module({ providers: [ArticleService], exports: [ArticleService] })
export class CoreApiModule {}
