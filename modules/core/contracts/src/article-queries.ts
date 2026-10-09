// SPDX-License-Identifier: MIT
import {
  defineListDeclaration,
  defineListQueryContract,
  defineQueryContract,
  outsideText,
  timestamp,
  version,
} from '@northmes/contracts';
import { z } from 'zod';

/**
 * An article's plants as the operations answer them: the slugs of the plants it is assigned to,
 * from the plants a service hands out. Empty for an article assigned to All plants.
 */
const plantSlugs = z.codec(z.array(z.string()), z.array(z.object({ slug: z.string() })), {
  decode: (slugs) => slugs.map((slug) => ({ slug })),
  encode: (plants) => plants.map(({ slug }) => slug),
});

/**
 * An article as core's operations answer it, the component CoreArticle of the public API
 * (ADR 0073). Its article number and name are outside text, since an ERP writes both through the
 * upsert, so the tool surfaces wrap them.
 */
export const article = z.object({
  id: z.uuid(),
  code: outsideText(),
  name: outsideText(),
  allPlants: z.boolean(),
  plants: plantSlugs,
  version,
  archivedAt: timestamp.nullable(),
  updatedAt: timestamp,
});

/**
 * The list of articles (ADR 0016, ADR 0073): by code unless orderBy says otherwise, with search over
 * code and name, the filter fields code (exact match) and unassigned (only the articles of no plant
 * and not of All plants), and without archived articles unless includeArchived asks for them. The
 * backend's defineList reads it for coreArticles, and core.findArticles derives from it.
 */
export const articleList = defineListDeclaration({
  name: 'Article',
  node: article,
  sortFields: {
    code: { column: 'code', type: 'text' },
    name: { column: 'name', type: 'text' },
    updatedAt: { column: 'updated_at', type: 'timestamptz' },
  },
  defaultOrderBy: ['code'],
  filters: { code: z.string(), unassigned: z.boolean() },
  search: ['code', 'name'],
  archivable: true,
});

/**
 * One page of the articles: at a plant, those assigned to it or to All plants; without a plant,
 * every article of the company, unassigned ones included (ADR 0073).
 */
export const findArticles = defineListQueryContract({
  name: 'core.findArticles',
  list: articleList,
  permission: 'core.article:read',
});

/**
 * One article of the company by id, also one that is not assigned to the request's plant, since a
 * row that kept an article after its plant was removed still shows it (ADR 0073).
 */
export const getArticle = defineQueryContract({
  name: 'core.getArticle',
  input: z.object({ id: z.uuid() }),
  output: article,
  permission: 'core.article:read',
});
