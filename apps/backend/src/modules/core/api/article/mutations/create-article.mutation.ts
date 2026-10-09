// SPDX-License-Identifier: AGPL-3.0-or-later
import { createArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { createArticleHandler } from '../../../core/commands/create-article.handler.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreCreateArticle, which the SDK generates from the contract of core.createArticle
 * and which returns the Article that createArticleHandler creates.
 */
export const CreateArticle = defineCommand(createArticle, {
  returns: () => Article,
  ...createArticleHandler,
});
