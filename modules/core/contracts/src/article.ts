// SPDX-License-Identifier: MIT
import { defineCommandContract, version } from '@northmes/contracts';
import { z } from 'zod';
import { tooLong } from './messages.ts';
import { plantSlug } from './plant.ts';
import { settingsCompanyId } from './role.ts';

/**
 * The identity fields a person edits on an article, which core.createArticle and
 * core.updateArticle share and the web's article form validates: its code, the article number
 * that is unique within the company (ADR 0073), and its name. Both are trimmed and required. 32
 * characters is the code limit of every register (ADR 0009). Each message states the rule and the fix (design ui-222, Copy), and the
 * server and the web form give the same one (ADR 0017).
 */
export const articleFields = z.object({
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

/** The refusal of All plants together with a list of plants. */
const plantsOrAllPlants = 'Choose plants or All plants, not both.';

/**
 * Where an article is used (ADR 0073): a list of plants by their slugs, or All plants, which also
 * covers plants the company creates later. A list together with All plants is refused on plants.
 */
const articlePlants = z
  .object({ allPlants: z.boolean(), plants: z.array(plantSlug) })
  .refine(({ allPlants, plants }) => !(allPlants && plants.length > 0), {
    error: plantsOrAllPlants,
    path: ['plants'],
  });

/**
 * Creates an article of the company under the client-generated id in the input, so a retry
 * returns the first article (ADR 0012). It is assigned to the plants or to All plants that the
 * input names, or else to the request's plant, or to no plant from company settings, where the
 * input names the company in companyId (ADR 0073). A code that another article of the company
 * uses is refused with core.code_taken, and a slug that names no plant of the company on plants.
 */
export const createArticle = defineCommandContract({
  name: 'core.createArticle',
  target: 'new',
  fields: articleFields
    .extend({
      allPlants: z.boolean().optional(),
      plants: z.array(plantSlug).optional(),
      companyId: settingsCompanyId,
    })
    .refine(({ allPlants, plants }) => !(allPlants === true && (plants?.length ?? 0) > 0), {
      error: plantsOrAllPlants,
      path: ['plants'],
    }),
  permission: 'core.article:create',
});

/**
 * Changes the code and name of an article, which the input names by id with the version the change
 * was made on. A stale version is refused with core.version_conflict, and a code that another
 * article of the company uses with core.code_taken.
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

/**
 * Replaces the plants of an article, which the input names by id with the version the change was
 * made on: a list of plants, or All plants, or neither for an article that only company views
 * show (ADR 0073). A plant taken off keeps its rows that use the article, and new rows there can no
 * longer pick it. It needs core.article:assign at the company.
 */
export const setArticlePlants = defineCommandContract({
  name: 'core.setArticlePlants',
  target: 'existing',
  fields: articlePlants,
  permission: 'core.article:assign',
});

/**
 * Creates or changes the article with this article number in the company, for an ERP that pushes
 * its articles (ADR 0073). Without one, it creates the article under `id`, as core.createArticle
 * does, also for its plants. With an active one, it renames it when `name` differs, which needs
 * core.article:update at the article's edit scope, and replaces its plants when the input names
 * other ones, which needs core.article:assign at the company; an input without plants leaves them
 * as they are. A rename checks `expectedVersion`, or the version it found. An archived article is
 * refused with core.archived. The bus checks core.article:create where a new article would be
 * edited, also when the article exists.
 */
export const upsertArticle = defineCommandContract({
  name: 'core.upsertArticle',
  target: 'none',
  fields: articleFields
    .extend({
      id: z.uuid(),
      allPlants: z.boolean().optional(),
      plants: z.array(plantSlug).optional(),
      expectedVersion: version.optional(),
      companyId: settingsCompanyId,
    })
    .refine(({ allPlants, plants }) => !(allPlants === true && (plants?.length ?? 0) > 0), {
      error: plantsOrAllPlants,
      path: ['plants'],
    }),
  permission: 'core.article:create',
});
