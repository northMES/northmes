// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Ref } from 'react';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
/**
 * The order filter of the board and the Gantt (ADR 0090, The order filter): a search field named
 * Filter orders that filters as the planner types, 250 ms after the last key, up to 100
 * characters; Escape or Clear filter empties it at once.
 */
export function OrderFilterField({
  value,
  onChange,
  inputRef,
}: {
  readonly value: string;
  readonly onChange: (filter: string) => void;
  readonly inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <SearchField
      label="Filter orders"
      value={value}
      onSearch={onChange}
      delayMs={250}
      clearLabel="Clear filter"
      inputRef={inputRef}
      className="w-48"
    />
  );
}
