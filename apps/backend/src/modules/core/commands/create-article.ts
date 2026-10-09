// SPDX-License-Identifier: AGPL-3.0-or-later
import { createArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import { type ArticleRecord, recordColumns } from '../api/article.service.ts';
import { Article } from '../api/article.type.ts';
import type { CoreContext } from './context.ts';

/**
 * core.createArticle, whose mutation coreCreateArticle the SDK generates from the contract. It
 * writes the article at the principal's plant under the client's id and returns it with version 1,
 * or returns the article a first run with that id created.
 */
export const CreateArticle = defineCommand(createArticle, {
  returns: () => Article,
  async handle({ id, code, name }, { tx, plantId }: CoreContext): Promise<ArticleRecord> {
    if (!plantId) {
      throw new DomainError({
        code: 'core.plant_forbidden',
        kind: 'forbidden',
        message: 'The request names no plant, so it cannot create an article',
      });
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
      throw new DomainError({
        code: 'core.not_found',
        kind: 'not_found',
        message: `Article ${id} was not found`,
      });
    }
    return first;
  },
});
