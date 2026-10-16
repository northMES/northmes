// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineCommandContract, translations } from '@northmes/contracts';
import { z } from 'zod';
import { tooLong } from './messages.ts';
import { settingsCompanyId } from './role.ts';

/**
 * The fields a person edits on an article group, which create and update share and the web's form
 * validates: its code, unique within the company (ADR 0009), its name, both trimmed and required,
 * and the translations of its name (ADR 0053), which an update that leaves them out keeps.
 */
export const articleGroupFields = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a code.')
    .max(32, { error: tooLong('Code', 32) })
    .describe("The group's code, unique within the company, at most 32 characters."),
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(200, { error: tooLong('Name', 200) })
    .describe("The group's name, at most 200 characters."),
  translations: translations
    .describe('The translations of the name. An update that leaves them out keeps them.')
    .optional(),
});

/**
 * Creates an article group of the company under the client-generated id in the input, so a retry
 * returns the first group (ADR 0012). A group belongs to the company, so the bus checks
 * core.articleGroup:create at the company: of the request's plant, or in company settings the one
 * companyId names. A code that another group of the company uses is refused with core.code_taken.
 */
export const createArticleGroup = defineCommandContract({
  name: 'core.createArticleGroup',
  description:
    'Creates an article group of the company. Needs core.articleGroup:create at the company; a code that another group of the company uses is refused with core.code_taken.',
  target: 'new',
  fields: articleGroupFields.extend({ companyId: settingsCompanyId }),
  permission: 'core.articleGroup:create',
});

/**
 * Changes the code, name and translations of an article group, which the input names by id with
 * the version the change was made on. An archived group is refused with core.archived.
 */
export const updateArticleGroup = defineCommandContract({
  name: 'core.updateArticleGroup',
  description:
    'Changes the code, name and translations of an article group. Needs core.articleGroup:update; an archived group is refused with core.archived.',
  target: 'existing',
  fields: articleGroupFields,
  permission: 'core.articleGroup:update',
});

/**
 * Archives an article group: lists hide it and no article can pick it, while the articles that
 * have it keep it (ADR 0006). An archived group is refused with core.archived.
 */
export const archiveArticleGroup = defineCommandContract({
  name: 'core.archiveArticleGroup',
  description:
    'Archives an article group: lists hide it and no article can pick it, while the articles that have it keep it. Needs core.articleGroup:archive.',
  target: 'existing',
  fields: z.object({}),
  permission: 'core.articleGroup:archive',
});

/** Restores an archived article group. A group that is not archived: core.not_archived. */
export const restoreArticleGroup = defineCommandContract({
  name: 'core.restoreArticleGroup',
  description:
    'Restores an archived article group. Needs core.articleGroup:archive; a group that is not archived is refused with core.not_archived.',
  target: 'existing',
  fields: z.object({}),
  permission: 'core.articleGroup:archive',
});
