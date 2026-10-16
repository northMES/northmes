// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { ChevronDown, Group } from 'lucide-react';
import { Button } from '../../primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../primitives/dropdown-menu.tsx';

/** One choice of a choice menu: its value, or undefined for none, and its text. */
export interface Choice<TValue extends string> {
  readonly value: TValue | undefined;
  readonly label: string;
}

export interface ChoiceMenuProps<TValue extends string> {
  /** The menu's name, such as "Group by". */
  readonly label: string;
  readonly choices: readonly Choice<TValue>[];
  readonly value: TValue | undefined;
  readonly onChange: (value: TValue | undefined) => void;
}

/** The radio value of the choice of none. */
const noValue = '';

/**
 * A choice of one of a few values in a list's toolbar, such as Group by (design ui-222, LI29): an
 * outline button named by the menu, and by its choice once one is made, such as "Group by:
 * Article group", that opens a menu of radio items.
 */
export function ChoiceMenu<TValue extends string>({
  label,
  choices,
  value,
  onChange,
}: ChoiceMenuProps<TValue>) {
  const chosen = choices.find((choice) => choice.value !== undefined && choice.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Group aria-hidden />
        {chosen === undefined ? label : `${label}: ${chosen.label}`}
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup
          value={value ?? noValue}
          onValueChange={(next: string) =>
            onChange(next === noValue ? undefined : (next as TValue))
          }
        >
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.value ?? noValue} value={choice.value ?? noValue}>
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
