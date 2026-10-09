// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';
import { tooLong } from './messages.ts';

/**
 * The fields a person edits on an article: its code, the article number that is unique at its
 * scope, and its name. Both are trimmed and required. 32 characters is the code limit of every
 * register (ADR 0009). Each message states the rule and the fix (design ui-222, Copy), and the
 * server and the web form give the same one (ADR 0017).
 */
const articleFields = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter an article number.')
    .max(32, { error: tooLong('Article number', 32) }),
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(200, { error: tooLong('Name', 200) }),
});

/**
 * Creates an article at the request's plant under the client-generated id in the input, so a retry
 * returns the first article (ADR 0012). A code that another article at the scope uses is refused
 * with core.code_taken.
 */
export const createArticle = defineCommandContract({
  name: 'core.createArticle',
  target: 'new',
  fields: articleFields,
  permission: 'core.article:create',
});

/**
 * Changes the code and name of an article, which the input names by id with the version the change
 * was made on. A stale version is refused with core.version_conflict, and a code that another
 * article at the scope uses with core.code_taken.
 */
export const updateArticle = defineCommandContract({
  name: 'core.updateArticle',
  target: 'existing',
  fields: articleFields,
  permission: 'core.article:update',
});

/**
 * Archives an article, which the input names by id with the version the change was made on.
 * Lists hide an archived article, it keeps its code, and it cannot be changed until it is
 * restored (ADR 0006). An archived article is refused with core.archived.
 */
export const archiveArticle = defineCommandContract({
  name: 'core.archiveArticle',
  target: 'existing',
  fields: z.object({}),
  permission: 'core.article:archive',
});

/**
 * Restores an archived article, so lists show it and it can be changed again. An article that is
 * not archived is refused with core.not_archived.
 */
export const restoreArticle = defineCommandContract({
  name: 'core.restoreArticle',
  target: 'existing',
  fields: z.object({}),
  permission: 'core.article:archive',
});
