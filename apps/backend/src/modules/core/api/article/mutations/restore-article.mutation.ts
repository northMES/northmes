// SPDX-License-Identifier: AGPL-3.0-or-later
import { restoreArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { restoreArticleHandler } from '../../../core/commands/restore-article.handler.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreRestoreArticle, which the SDK generates from the contract of core.restoreArticle
 * and which returns the Article that restoreArticleHandler changes.
 */
export const RestoreArticle = defineCommand(restoreArticle, {
  returns: () => Article,
  ...restoreArticleHandler,
});
