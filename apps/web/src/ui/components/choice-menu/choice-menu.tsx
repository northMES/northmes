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
import { IconButton } from '../icon-button/index.ts';

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
  /**
   * The icon alone as the button, for a table's header row (#875): the name, with the choice once
   * one is made, stays as the tooltip and for assistive technology, on a 24 px target.
   */
  readonly compact?: boolean;
}

/** The radio value of the choice of none. */
const noValue = '';

/**
 * A choice of one of a few values, such as Group by (design ui-222, LI29): a button named by the
 * menu, and by its choice once one is made, such as "Group by: Article group", that opens a menu
 * of radio items. In a list's toolbar the button is an outline button with its text; in a table's
 * header row it is the icon alone.
 */
export function ChoiceMenu<TValue extends string>({
  label,
  choices,
  value,
  onChange,
  compact = false,
}: ChoiceMenuProps<TValue>) {
  const chosen = choices.find((choice) => choice.value !== undefined && choice.value === value);
  const name = chosen === undefined ? label : `${label}: ${chosen.label}`;
  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger
          render={
            <IconButton label={name} variant="ghost" size="icon-sm">
              <Group aria-hidden />
            </IconButton>
          }
        />
      ) : (
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <Group aria-hidden />
          {name}
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={compact ? 'end' : 'start'} className="min-w-48">
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
