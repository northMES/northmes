// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineEventContract } from '@northmes/contracts';
import { z } from 'zod';

/**
 * What every article event carries: the article's code and name after the change, so a consumer
 * such as a log needs no read of its own. The event row carries the article's id, version and
 * company.
 */
const articleEventData = z.object({ code: z.string(), name: z.string() });

/** core.createArticle, or core.upsertArticle for a new code, created an article. */
export const articleCreated = defineEventContract({
  name: 'core.article.created',
  version: 1,
  entity: 'core.article',
  data: articleEventData,
});

/** core.updateArticle, or core.upsertArticle for a code that exists, changed an article. */
export const articleUpdated = defineEventContract({
  name: 'core.article.updated',
  version: 1,
  entity: 'core.article',
  data: articleEventData,
});

/** core.archiveArticle archived an article. */
export const articleArchived = defineEventContract({
  name: 'core.article.archived',
  version: 1,
  entity: 'core.article',
  data: articleEventData,
});

/** core.restoreArticle restored an archived article. */
export const articleRestored = defineEventContract({
  name: 'core.article.restored',
  version: 1,
  entity: 'core.article',
  data: articleEventData,
});
