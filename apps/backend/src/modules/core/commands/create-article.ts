// SPDX-License-Identifier: AGPL-3.0-or-later
import { createArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import { type ArticleRecord, recordColumns } from '../api/article.service.ts';
import { Article } from '../api/article.type.ts';
import type { CoreContext } from './context.ts';

/**
 * core.createArticle, whose mutation coreCreateArticle the SDK generates from the contract. It
 * writes the article at the principal's plant and returns it with version 1.
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
    return tx
      .insertInto('core.article')
      .values({ id, scope_id: plantId, code, name })
      .returning(recordColumns)
      .executeTakeFirstOrThrow();
  },
});
