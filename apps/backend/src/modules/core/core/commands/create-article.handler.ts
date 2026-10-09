// SPDX-License-Identifier: AGPL-3.0-or-later
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { createArticle } from '@northmes/core-contracts';
import type { z } from 'zod';
import { type ArticleRecord, recordColumns } from '../article.service.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.createArticle (ADR 0012), which the mutation coreCreateArticle sends through
 * the command bus. It writes the article at the principal's plant under the client's id and returns
 * it with version 1, or returns the article a first run with that id created.
 */
export const createArticleHandler = {
  async handle(
    { id, code, name }: z.output<typeof createArticle.input>,
    { tx, plantId }: CoreContext,
  ): Promise<ArticleRecord> {
    // The bus refuses a create from a request without a plant before the handler runs.
    if (!plantId) {
      throw new ForbiddenException('The request names no plant, so it cannot create an article');
    }
    const created = await tx
      .insertInto('core.article')
      .values({ id, scope_id: plantId, code, name })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .returning(recordColumns)
      .executeTakeFirst();
    if (created) return created;
    // A retry after a timeout or a restart finds the article the first run created (ADR 0012).
    const first = await tx
      .selectFrom('core.article')
      .select(recordColumns)
      .where('id', '=', id)
      .executeTakeFirst();
    if (!first) {
      // The id is taken at a scope the principal cannot read.
      throw new NotFoundException(`Article ${id} was not found`);
    }
    return first;
  },
};
