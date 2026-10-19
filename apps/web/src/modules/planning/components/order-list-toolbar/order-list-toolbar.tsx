// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ReactNode } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import type { FacetValue } from '../../order-list-rows.ts';
import type { ListFilterKey } from '../../order-list-search.ts';

/** One filter field of a list: its texts, its values with their counts and the picked ones. */
export interface ListFilterField {
  readonly key: ListFilterKey;
  /** The menu button's text, such as "Customer". */
  readonly label: string;
  /** The line above the values, such as "Show orders of these customers". */
  readonly heading: string;
  /** The chip's remove button, such as "Remove the customer filter". */
  readonly remove: string;
  readonly values: readonly FacetValue[];
  readonly picked: readonly string[];
}

export interface OrderListToolbarProps {
  /** The id of the search input, where Clear filters moves focus. */
  readonly searchId: string;
  /** The search field's name, "Search production orders". */
  readonly searchLabel: string;
  readonly q: string;
  readonly onSearch: (q: string) => void;
  readonly lateOnly: boolean;
  readonly onLateOnlyChange: (on: boolean) => void;
  readonly fields: readonly ListFilterField[];
  readonly onFilterChange: (key: ListFilterKey, values: readonly string[]) => void;
  readonly onClearFilters: () => void;
  /** Group by, on the list that groups. */
  readonly groupMenu?: ReactNode;
  readonly columns: readonly {
    readonly id: string;
    readonly label: string;
    readonly alwaysShown?: boolean;
  }[];
  readonly hiddenColumns: readonly string[];
  readonly onHiddenColumnsChange: (hidden: readonly string[]) => void;
}

/**
 * The toolbar the order lists share (design ui-222, LI1 and LI3; #687): the search, Late only, a
 * filter menu per field with the counts of its values, Group by where the list groups, Columns,
 * and under them the chips of the filters that apply with Clear filters, which keeps the search,
 * Late only and the grouping.
 */
export function OrderListToolbar({
  searchId,
  searchLabel,
  q,
  onSearch,
  lateOnly,
  onLateOnlyChange,
  fields,
  onFilterChange,
  onClearFilters,
  groupMenu,
  columns,
  hiddenColumns,
  onHiddenColumnsChange,
}: OrderListToolbarProps) {
  const lateOnlyId = `${searchId}-late-only`;
  const filtered = fields.some((field) => field.picked.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            id={searchId}
            label={searchLabel}
            value={q}
            onSearch={onSearch}
            className="w-full max-w-sm"
          />
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id={lateOnlyId}
              checked={lateOnly}
              onCheckedChange={(checked) => onLateOnlyChange(checked)}
            />
            <FieldLabel htmlFor={lateOnlyId}>Late only</FieldLabel>
          </Field>
          {fields.map((field) => (
            <FilterMenu
              key={field.key}
              label={field.label}
              heading={field.heading}
              options={field.values}
              selected={field.picked}
              onChange={(values) => onFilterChange(field.key, values)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {groupMenu}
          <ColumnsMenu columns={columns} hidden={hiddenColumns} onChange={onHiddenColumnsChange} />
        </div>
      </div>
      {filtered && (
        <div className="flex flex-wrap items-center gap-2">
          {fields.map((field) =>
            field.picked.length === 0 ? null : (
              <FilterChip
                key={field.key}
                label={field.label}
                values={field.picked.map((value) => {
                  const facet = field.values.find((each) => each.value === value);
                  return { label: facet?.label ?? value, count: facet?.count ?? 0 };
                })}
                removeLabel={field.remove}
                onRemove={() => onFilterChange(field.key, [])}
              />
            ),
          )}
          <Button
            variant="link"
            onClick={() => {
              onClearFilters();
              document.getElementById(searchId)?.focus();
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
