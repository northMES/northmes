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
 * An article group as core's operations answer it. Its code and name are outside text, since an
 * ERP may name them.
 */
export const articleGroup = z.object({
  id: z.uuid(),
  code: outsideText(),
  name: outsideText(),
  translations: z
    .array(z.object({ field: z.string(), locale: z.string(), text: outsideText() }))
    .readonly(),
  version,
  archivedAt: timestamp.nullable(),
  updatedAt: timestamp,
});

/**
 * The list of the company's article groups (ADR 0016): by code unless orderBy says otherwise, with
 * search over code and name, and without archived groups unless includeArchived asks for them.
 */
export const articleGroupList = defineListDeclaration({
  name: 'ArticleGroup',
  node: articleGroup,
  sortFields: {
    code: { column: 'code', type: 'text' },
    name: { column: 'name', type: 'text' },
    updatedAt: { column: 'updated_at', type: 'timestamptz' },
  },
  defaultOrderBy: ['code'],
  search: ['code', 'name'],
  archivable: true,
});

/** One page of the company's article groups, at a plant or in company settings. */
export const findArticleGroups = defineListQueryContract({
  name: 'core.findArticleGroups',
  list: articleGroupList,
  permission: 'core.articleGroup:read',
});

/** One article group of the company by id. */
export const getArticleGroup = defineQueryContract({
  name: 'core.getArticleGroup',
  input: z.object({ id: z.uuid() }),
  output: articleGroup,
  permission: 'core.articleGroup:read',
});
