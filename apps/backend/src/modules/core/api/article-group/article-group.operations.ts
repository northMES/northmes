// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { articleGroupOperations } from '@northmes/core-contracts';
import { bindOperations } from '@northmes/sdk/operations';
import { ArticleGroupService } from '../../core/article-group.service.ts';

/**
 * Core's article group operations bound to ArticleGroupService (ADR 0073): each calls one method
 * of the service, which every surface calls, and holds no logic of its own.
 */
export const ArticleGroupOperations = bindOperations(articleGroupOperations, {
  find: (input, context) => context.get(ArticleGroupService).find(input),
  get: (input, context) => context.get(ArticleGroupService).byIdOrThrow(input.id),
  create: (input, context) => context.get(ArticleGroupService).create(input),
  update: (input, context) => context.get(ArticleGroupService).update(input),
  archive: (input, context) => context.get(ArticleGroupService).archive(input),
  restore: (input, context) => context.get(ArticleGroupService).restore(input),
});
