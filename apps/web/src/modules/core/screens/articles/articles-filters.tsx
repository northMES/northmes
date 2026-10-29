// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useQuery } from '@apollo/client/react';
import { type StockUnitCode, stockUnitCodes, unitOf } from '@northmes/contracts';
import { ChoiceMenu } from '../../../../ui/components/choice-menu/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { CoreArticleGroups } from '../../article-groups.graphql.ts';
import {
  type ArticleGroupKey,
  type ArticleListSearch,
  filteredBy,
  groupedBy,
  isFiltered,
  noArticleGroup,
  northmesSource,
  unfiltered,
} from '../../article-list-search.ts';
import type { ArticleFacets } from './article-facets.graphql.ts';
import { type FieldValue, pickedOf, valuesOf } from './articles-values.ts';

/** A filter field's menu and chip texts (design ui-222, Copy). */
const fields: readonly {
  readonly key: ArticleGroupKey;
  readonly label: string;
  readonly heading: string;
  readonly remove: string;
}[] = [
  {
    key: 'articleGroup',
    label: 'Article group',
    heading: 'Show articles in these groups',
    remove: 'Remove the article group filter',
  },
  {
    key: 'stockUnit',
    label: 'Stock unit',
    heading: 'Show articles counted in',
    remove: 'Remove the stock unit filter',
  },
  {
    key: 'source',
    label: 'Source',
    heading: 'Show articles from',
    remove: 'Remove the source filter',
  },
];

/** The choices of Group by (LI29). */
const groupChoices = [
  { value: undefined, label: 'No grouping' },
  { value: 'articleGroup', label: 'Article group' },
  { value: 'stockUnit', label: 'Stock unit' },
  { value: 'source', label: 'Source' },
] as const;

interface FiltersProps {
  readonly view: ArticleListSearch;
  readonly facets: ArticleFacets | undefined;
  readonly show: (view: ArticleListSearch) => void;
}

/**
 * A picked value that no listed article has, or that the counts have not answered yet: it shows
 * with 0 (ST17), named as its field names it: a group by the group list, a stock unit by the unit
 * catalog, a source by its name, and the empty source as NorthMES.
 */
function withPicked(
  field: ArticleGroupKey,
  values: readonly FieldValue[],
  picked: readonly string[],
  groupName: (value: string) => string,
): FieldValue[] {
  const known = new Set(values.map(({ value }) => value));
  const nameOf = (value: string): string => {
    if (field === 'articleGroup') return groupName(value);
    if (field === 'source') return value === northmesSource ? 'NorthMES' : value;
    return isStockUnitCode(value) ? unitOf(value).label : value;
  };
  return [
    ...values,
    ...picked
      .filter((value) => !known.has(value))
      .map((value) => ({ value, label: nameOf(value), count: 0 })),
  ];
}

/** Whether a picked stock unit is a code of the unit catalog's stock units. */
function isStockUnitCode(value: string): value is StockUnitCode {
  return (stockUnitCodes as readonly string[]).includes(value);
}

/** The names of the company's groups, read only while a picked group is missing from the counts. */
function useGroupNames(view: ArticleListSearch, facets: ArticleFacets | undefined) {
  const counted = new Set(valuesOf('articleGroup', facets).map(({ value }) => value));
  const missing = pickedOf(view, 'articleGroup').some(
    (value) => value !== noArticleGroup && !counted.has(value),
  );
  const { data } = useQuery(CoreArticleGroups, {
    variables: { includeArchived: true },
    skip: !missing,
  });
  return (value: string) =>
    value === noArticleGroup
      ? 'No article group'
      : (data?.coreArticleGroups.edges.find(({ node }) => node.id === value)?.node.name ??
        'Unknown group');
}

/**
 * The filter menus of the articles toolbar (design ui-222, LI3): Article group, Stock unit and
 * Source, each listing its values with how many articles have each.
 */
export function ArticlesFilterMenus({ view, facets, show }: FiltersProps) {
  const nameOf = useGroupNames(view, facets);
  return (
    <>
      {fields.map(({ key, label, heading }) => (
        <FilterMenu
          key={key}
          label={label}
          heading={heading}
          options={withPicked(key, valuesOf(key, facets), pickedOf(view, key), nameOf)}
          selected={pickedOf(view, key)}
          onChange={(picked) => show(filteredBy(view, key, picked as never))}
        />
      ))}
    </>
  );
}

/**
 * Group by in the articles table's header row (design ui-222, LI29; #875): the icon alone, named
 * "Group by" and by its choice once one is made.
 */
export function ArticlesGroupMenu({ view, show }: Pick<FiltersProps, 'view' | 'show'>) {
  return (
    <ChoiceMenu
      compact
      label="Group by"
      choices={groupChoices}
      value={view.group}
      onChange={(group) => show(groupedBy(view, group))}
    />
  );
}

/**
 * The chips of the filters that apply, each with the picked values and their counts and a button
 * that removes it, then Clear filters, which keeps the search and the grouping (LI3, ST17).
 */
export function ArticlesFilterChips({ view, facets, show }: FiltersProps) {
  const nameOf = useGroupNames(view, facets);
  if (!isFiltered(view)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fields.map(({ key, label, remove }) => {
        const picked = pickedOf(view, key);
        if (picked.length === 0) return null;
        const values = withPicked(key, valuesOf(key, facets), picked, nameOf).filter(({ value }) =>
          picked.includes(value),
        );
        return (
          <FilterChip
            key={key}
            label={label}
            values={values}
            removeLabel={remove}
            onRemove={() => show(filteredBy(view, key, []))}
          />
        );
      })}
      <Button variant="link" onClick={() => show(unfiltered(view))}>
        Clear filters
      </Button>
    </div>
  );
}
