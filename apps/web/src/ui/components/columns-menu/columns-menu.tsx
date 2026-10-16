// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ChevronDown, Columns3 } from 'lucide-react';
import { Button } from '../../primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../primitives/dropdown-menu.tsx';

/** A column the Columns menu offers: its id, its header and whether it can be hidden. */
export interface ColumnChoice {
  readonly id: string;
  readonly label: string;
  /** The column that names a row, such as Article number, which is never hidden. */
  readonly alwaysShown?: boolean;
}

export interface ColumnsMenuProps {
  readonly columns: readonly ColumnChoice[];
  /** The ids of the hidden columns. */
  readonly hidden: readonly string[];
  /** Hands back the hidden columns after one was shown or hidden. */
  readonly onChange: (hidden: readonly string[]) => void;
}

/**
 * Columns in a list's toolbar (design ui-222, LI11 to LI14): a menu with a checkbox per column,
 * checked while the column shows. The column that names a row stays checked and cannot be
 * turned, and says "Always shown". The menu stays open while columns are turned.
 */
export function ColumnsMenu({ columns, hidden, onChange }: ColumnsMenuProps) {
  const hiddenSet = new Set(hidden);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Columns3 aria-hidden />
        Columns
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show these columns</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.alwaysShown === true || !hiddenSet.has(column.id)}
              disabled={column.alwaysShown === true}
              closeOnClick={false}
              onCheckedChange={(shown: boolean) =>
                onChange(
                  columns
                    .map(({ id }) => id)
                    .filter((id) => (id === column.id ? !shown : hiddenSet.has(id))),
                )
              }
            >
              <span>{column.label}</span>
              {column.alwaysShown === true && (
                <>
                  {' '}
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">Always shown</span>
                </>
              )}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
