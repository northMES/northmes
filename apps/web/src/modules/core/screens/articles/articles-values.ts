// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { unitOf } from '@northmes/contracts';
import {
  type ArticleGroupKey,
  type ArticleListSearch,
  noArticleGroup,
  northmesSource,
} from '../../article-list-search.ts';
import type { ArticleFacets } from './article-facets.graphql.ts';

/** One value of a filter field as the menus, the chips and the groups show it. */
export interface FieldValue {
  /** The value's token in the URL, such as a group's id, none, METRE or NorthMES. */
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/** The values of a filter field with their counts, in the order the API counts them. */
export function valuesOf(field: ArticleGroupKey, facets: ArticleFacets | undefined): FieldValue[] {
  if (facets === undefined) return [];
  if (field === 'articleGroup') {
    return facets.articleGroups.map(({ id, name, count }) => ({
      value: id ?? noArticleGroup,
      label: name ?? 'No article group',
      count,
    }));
  }
  if (field === 'stockUnit') {
    return facets.stockUnits.map(({ stockUnit, count }) => ({
      value: stockUnit,
      label: unitOf(stockUnit).label,
      count,
    }));
  }
  return facets.sources.map(({ source, count }) => ({
    value: source ?? northmesSource,
    label: source ?? 'NorthMES',
    count,
  }));
}

/** The picked values of a filter field, in the view. */
export function pickedOf(view: ArticleListSearch, field: ArticleGroupKey): readonly string[] {
  return view[field] ?? [];
}
