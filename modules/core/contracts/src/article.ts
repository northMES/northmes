// SPDX-License-Identifier: MIT
import { defineCommandContract, stockUnit, translations, version } from '@northmes/contracts';
import { z } from 'zod';
import { atMost, tooLong } from './messages.ts';
import { plantSlug } from './plant.ts';
import { settingsCompanyId } from './role.ts';

/**
 * The identity fields a person edits on an article, which core.createArticle and core.updateArticle
 * share and the web's article form validates: its code, the article number that is unique within
 * the company (ADR 0073), and its name. Both are trimmed and required. 32 characters is the code
 * limit of every register (ADR 0009). Each message states the rule and the fix (design ui-222,
 * Copy), and the server and the web form give the same one (ADR 0017).
 */
export const articleFields = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter an article number.')
    .max(32, { error: tooLong('Article number', 32) })
    .describe('The article number, unique within the company, at most 32 characters.'),
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(200, { error: tooLong('Name', 200) })
    .describe("The article's name, at most 200 characters."),
});

/**
 * An article's note, trimmed, at most 2000 characters. An empty note is none, so a form clears the
 * note by sending it empty.
 */
export const articleNote = z
  .string()
  .trim()
  .max(2000, { error: atMost('Note', 2000) })
  .transform((note) => (note === '' ? null : note));

/**
 * The translations of an article's name (ADR 0053), at most one per language. An article
 * translates only its name.
 */
export const articleTranslations = translations.superRefine((list, context) => {
  list.forEach(({ field }, index) => {
    if (field !== 'name') {
      context.addIssue({
        code: 'custom',
        path: [index, 'field'],
        message: 'An article translates only its name.',
      });
    }
  });
});

/** A uuid, as z.uuid() checks it. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The article group an article picks, an active group of its company, by id; an empty value picks
 * none, so a form removes the group by sending it empty.
 */
export const articleGroupId = z
  .string()
  .trim()
  .refine((id) => id === '' || uuid.test(id), 'Choose an active article group of the company.')
  .transform((id) => (id === '' ? null : id.toLowerCase()));

/**
 * The fields that classify an article, which create, update and upsert share (design ui-222,
 * DE7): its stock unit, a code of the unit catalog in which its quantities are counted (ADR 0023),
 * and its note. Each may be left out: a new article then counts in pieces and has no note, and an
 * existing one keeps what it has.
 */
export const articleClassification = z.object({
  stockUnit: stockUnit
    .describe(
      "The code of the unit the article's quantities are counted in. A new article without one counts in pieces.",
    )
    .optional(),
  note: articleNote
    .describe('A note on the article, at most 2000 characters; an empty note removes it.')
    .optional(),
});

/**
 * The fields of an article that create, update and upsert take beside its identity: its name's
 * translations, its article group, its stock unit and its note. Each may be left out, which keeps
 * an existing article's value; an empty list of translations removes them.
 */
const articleDetails = articleClassification.extend({
  translations: articleTranslations
    .describe('The translations of the name; an empty list removes them.')
    .optional(),
  articleGroupId: articleGroupId
    .describe('The id of an active article group of the company; an empty value picks none.')
    .optional(),
});

/** The refusal of All plants together with a list of plants. */
const plantsOrAllPlants = 'Choose plants or All plants, not both.';

/**
 * Where an article is used (ADR 0073): a list of plants by their slugs, or All plants, which also
 * covers plants the company creates later. A list together with All plants is refused on plants.
 */
const articlePlants = z
  .object({
    allPlants: z
      .boolean()
      .describe('Assigns the article to every plant of the company, those created later included.'),
    plants: z
      .array(plantSlug)
      .describe('The slugs of the plants the article is assigned to; empty with allPlants.'),
  })
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
  description:
    "Creates an article of the company, assigned to the plants or to All plants that the input names, else to the request's plant. Needs core.article:create; a code that another article of the company uses is refused with core.code_taken.",
  target: 'new',
  fields: articleFields
    .extend(articleDetails.shape)
    .extend({
      allPlants: z
        .boolean()
        .describe(
          'Assigns the article to every plant of the company, those created later included.',
        )
        .optional(),
      plants: z
        .array(plantSlug)
        .describe(
          "The slugs of the plants the article is assigned to. Without plants or allPlants, a new article is assigned to the request's plant.",
        )
        .optional(),
      companyId: settingsCompanyId,
    })
    .refine(({ allPlants, plants }) => !(allPlants === true && (plants?.length ?? 0) > 0), {
      error: plantsOrAllPlants,
      path: ['plants'],
    }),
  permission: 'core.article:create',
});

/**
 * Changes the code and name of an article, and its translations, stock unit and note when the input
 * names them, which the input names by id with the version the change was made on. A stale version
 * is refused with core.version_conflict, and a code that another article of the company uses with
 * core.code_taken.
 */
export const updateArticle = defineCommandContract({
  name: 'core.updateArticle',
  description:
    'Changes the code and name of an article, and its translations, stock unit, note and group when the input names them. Needs core.article:update; a code that another article uses is refused with core.code_taken.',
  target: 'existing',
  fields: articleFields.extend(articleDetails.shape),
  permission: 'core.article:update',
});

/**
 * Archives an article, which the input names by id with the version the change was made on.
 * Lists hide an archived article, it keeps its code, and it cannot be changed until it is
 * restored (ADR 0006). An archived article is refused with core.archived.
 */
export const archiveArticle = defineCommandContract({
  name: 'core.archiveArticle',
  description:
    'Archives an article: lists hide it, it keeps its code, and it cannot be changed until it is restored. Needs core.article:archive.',
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
  description:
    'Restores an archived article, so lists show it and it can be changed again. Needs core.article:archive.',
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
  description:
    'Replaces the plants of an article: a list of plants, All plants, or neither for an article that only company views show. Needs core.article:assign at the company.',
  target: 'existing',
  fields: articlePlants,
  permission: 'core.article:assign',
});

/**
 * The integration that sends an article through core.upsertArticle, such as Pyramid, trimmed, 1 to
 * 64 characters, without a comma and other than NorthMES. It names the integration until
 * integration tokens, whose principal names it, arrive (ADR 0073).
 */
export const articleSource = z
  .string()
  .trim()
  .min(1, 'Name the integration that sends the article.')
  .max(64, { error: tooLong('Source', 64) })
  // The articles list's source filter keeps its picks as a comma list, with NorthMES for the
  // articles created in NorthMES (design ui-222, URL keys).
  .refine(
    (name) => !name.includes(',') && name.toLowerCase() !== 'northmes',
    'Name the integration without a comma, and not NorthMES.',
  );

/**
 * Creates or changes the article with this article number in the company, for an ERP that pushes
 * its articles (ADR 0073). Without one, it creates the article under `id`, as core.createArticle
 * does, also for its plants. With an active one, it renames it when `name` differs, which needs
 * core.article:update at the article's edit scope, and replaces its plants when the input names
 * other ones, which needs core.article:assign at the company; an input without plants leaves them
 * as they are; translations, a stock unit or a note the input names replace the article's, which
 * also need core.article:update. `source` names the integration that sends the article, which a new
 * article keeps as where it came from; it never changes an existing article's source. A change
 * checks `expectedVersion`, or the version it found. An archived article is refused with
 * core.archived. The bus checks core.article:create where a new article would be edited, also when
 * the article exists.
 */
export const upsertArticle = defineCommandContract({
  name: 'core.upsertArticle',
  description:
    'Creates or changes the article with this article number in the company, for an ERP that pushes its articles. Needs core.article:create, and core.article:update or core.article:assign for the changes it makes to an existing article.',
  target: 'none',
  fields: articleFields
    .extend(articleDetails.shape)
    .extend({
      id: z
        .uuid()
        .describe('The id of the article if the command creates it, a UUID the client generates.'),
      source: articleSource.describe(
        'The integration that sends the article, such as Pyramid. A new article keeps it as its source.',
      ),
      allPlants: z
        .boolean()
        .describe(
          'Assigns the article to every plant of the company, those created later included.',
        )
        .optional(),
      plants: z
        .array(plantSlug)
        .describe(
          "The slugs of the plants the article is assigned to. Without plants or allPlants, a new article is assigned to the request's plant.",
        )
        .optional(),
      expectedVersion: version
        .describe(
          'The version a change to an existing article was made on, else the version found.',
        )
        .optional(),
      companyId: settingsCompanyId,
    })
    .refine(({ allPlants, plants }) => !(allPlants === true && (plants?.length ?? 0) > 0), {
      error: plantsOrAllPlants,
      path: ['plants'],
    }),
  permission: 'core.article:create',
});
