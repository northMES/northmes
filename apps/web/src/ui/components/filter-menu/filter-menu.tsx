// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ChevronDown } from 'lucide-react';
import { Badge } from '../../primitives/badge.tsx';
import { Button } from '../../primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../primitives/dropdown-menu.tsx';

/** One value of a filter menu: what it submits, its text and how many rows have it. */
export interface FilterMenuOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface FilterMenuProps {
  /** The filter's name, the button's text, such as "Article group". */
  readonly label: string;
  /** The line above the values, such as "Show articles in these groups". */
  readonly heading: string;
  readonly options: readonly FilterMenuOption[];
  /** The picked values; none keeps every row. */
  readonly selected: readonly string[];
  /** Hands back the picks after one value was turned on or off, in the options' order. */
  readonly onChange: (selected: readonly string[]) => void;
}

/**
 * A filter of a list's toolbar that keeps any of several values (design ui-222, LI3): an outline
 * button named by the filter, then how many values are picked, such as "Article group, 2
 * selected", whose badge shows the number; it opens a menu of checkbox items, each a value with
 * how many rows have it, read as "Hoses 21". The menu stays open while values are turned.
 */
export function FilterMenu({ label, heading, options, selected, onChange }: FilterMenuProps) {
  const picked = new Set(selected);
  const toggled = (value: string, on: boolean) =>
    options
      .map((option) => option.value)
      .filter((each) => (each === value ? on : picked.has(each)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            aria-label={selected.length === 0 ? undefined : `${label}, ${selected.length} selected`}
          />
        }
      >
        {label}
        {selected.length > 0 && (
          <Badge aria-hidden className="rounded-full px-1.5">
            {selected.length}
          </Badge>
        )}
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{heading}</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={picked.has(option.value)}
              closeOnClick={false}
              onCheckedChange={(on: boolean) => onChange(toggled(option.value, on))}
            >
              <span>{option.label}</span>{' '}
              <span className="ml-auto pl-4 font-mono text-xs text-muted-foreground">
                {option.count}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
