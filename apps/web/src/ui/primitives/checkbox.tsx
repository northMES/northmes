// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'react';
import { cn } from 'cn';

export interface CheckboxProps {
  /** The visible label, which is also the accessible name. */
  readonly label: string;
  readonly checked: boolean;
  /** Called with the state the person asks for; the caller owns checked. */
  readonly onCheckedChange: (checked: boolean) => void;
  readonly className?: string;
}

/**
 * A checkbox with its label, such as Show archived (design ui-222, Checkbox): a 16 px box in a
 * 24 px hit area, which the label widens. Space toggles it and focus stays on it.
 */
export function Checkbox({ label, checked, onCheckedChange, className }: CheckboxProps) {
  const id = useId();
  return (
    <span className={cn('inline-flex min-h-(--nm-target-min) items-center gap-2', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        className="size-4 shrink-0 accent-primary"
      />
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
    </span>
  );
}
