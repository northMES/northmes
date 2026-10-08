// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';

/**
 * The fields a person edits on an article: its code, the article number that is unique at its
 * scope, and its name. Both are trimmed and required. 32 characters is the code limit of every
 * register (ADR 0009).
 */
const articleFields = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
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
});
