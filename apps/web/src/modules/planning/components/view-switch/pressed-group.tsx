// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { Button } from '../../../../ui/primitives/button.tsx';

/** A group of pressed buttons, one pressed: the View and Zoom groups of D3 and D5. */
export function PressedGroup<TValue extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  readonly label: string;
  readonly choices: readonly { readonly id: TValue; readonly label: string }[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
}) {
  return (
    <fieldset aria-label={label} className="flex rounded-lg bg-muted p-0.5">
      {choices.map((choice) => (
        <Button
          key={choice.id}
          variant="ghost"
          aria-pressed={choice.id === value}
          onClick={() => onChange(choice.id)}
          className={cn(
            'h-7 px-2.5',
            choice.id === value && 'bg-card shadow-[inset_0_-2px_0_var(--foreground)]',
          )}
        >
          {choice.label}
        </Button>
      ))}
    </fieldset>
  );
}
