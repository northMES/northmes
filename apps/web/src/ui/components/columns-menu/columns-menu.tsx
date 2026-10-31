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
import { IconButton } from '../icon-button/index.ts';

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
  /**
   * The icon alone as the button, for a table's header row (#875): the name Columns stays, as the
   * tooltip and for assistive technology, on a 24 px target.
   */
  readonly compact?: boolean;
}

/** The menu's name, the button's text or its tooltip. */
const name = 'Columns';

/**
 * The columns as a group of a menu: a checkbox per column, checked while the column shows, and the
 * column that names a row checked, unturnable and "Always shown". The Columns menu holds it, and a
 * screen's own menu can too, such as the Gantt's View menu (ADR 0090).
 */
export function ColumnsMenuGroup({
  columns,
  hidden,
  onChange,
  label = 'Show these columns',
}: Omit<ColumnsMenuProps, 'compact'> & { readonly label?: string }) {
  const hiddenSet = new Set(hidden);
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
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
  );
}

/**
 * Columns (design ui-222, LI11 to LI14): a menu with a checkbox per column, checked while the
 * column shows. The column that names a row stays checked and cannot be turned, and says "Always
 * shown". The menu stays open while columns are turned. In a list's toolbar the button carries its
 * text; in a table's header row it is the icon alone.
 */
export function ColumnsMenu({ columns, hidden, onChange, compact = false }: ColumnsMenuProps) {
  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger
          render={
            <IconButton label={name} variant="ghost" size="icon-sm">
              <Columns3 aria-hidden />
            </IconButton>
          }
        />
      ) : (
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <Columns3 aria-hidden />
          {name}
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end" className="min-w-56">
        <ColumnsMenuGroup columns={columns} hidden={hidden} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
