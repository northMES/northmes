// SPDX-License-Identifier: AGPL-3.0-or-later
import { articleOperations } from '@northmes/core-contracts';
import { bindOperations } from '@northmes/sdk/operations';
import { ArticleService } from '../../core/article.service.ts';

/**
 * Core's article operations bound to ArticleService (ADR 0073): each calls one method of the
 * service, which every surface calls, and holds no logic of its own.
 */
export const ArticleOperations = bindOperations(articleOperations, {
  find: (input, context) => context.get(ArticleService).find(input),
  get: (input, context) => context.get(ArticleService).byIdOrThrow(input.id),
  create: (input, context) => context.get(ArticleService).create(input),
  update: (input, context) => context.get(ArticleService).update(input),
  setPlants: (input, context) => context.get(ArticleService).setPlants(input),
  archive: (input, context) => context.get(ArticleService).archive(input),
  restore: (input, context) => context.get(ArticleService).restore(input),
  upsert: (input, context) => context.get(ArticleService).upsertByCode(input),
});
