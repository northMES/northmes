// SPDX-License-Identifier: AGPL-3.0-or-later
import { updateArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { updateArticleHandler } from '../../../core/commands/update-article.handler.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreUpdateArticle, which the SDK generates from the contract of core.updateArticle
 * and which returns the Article that updateArticleHandler changes.
 */
export const UpdateArticle = defineCommand(updateArticle, {
  returns: () => Article,
  ...updateArticleHandler,
});
