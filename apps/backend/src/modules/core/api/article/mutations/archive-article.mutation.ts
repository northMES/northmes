// SPDX-License-Identifier: AGPL-3.0-or-later
import { archiveArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { archiveArticleHandler } from '../../../core/commands/archive-article.handler.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreArchiveArticle, which the SDK generates from the contract of core.archiveArticle
 * and which returns the Article that archiveArticleHandler changes.
 */
export const ArchiveArticle = defineCommand(archiveArticle, {
  returns: () => Article,
  ...archiveArticleHandler,
});
