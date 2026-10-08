// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field } from '@base-ui/react/field';
import { CircleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn.ts';

/** The D1 Input look: a 36 px control on the card surface with an --input border. */
export const inputClassName = cn(
  'h-(--nm-control-height) w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground',
  'placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground',
  'disabled:bg-muted disabled:opacity-50',
  // Invalid: a --destructive border plus a 1 px inset, kept beside the focus ring's inner band.
  'data-invalid:border-destructive data-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]',
  'data-invalid:focus-visible:shadow-[0_0_0_2px_var(--focus-ring),inset_0_0_0_1px_var(--destructive)]',
);

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'className' | 'type'> {
  /** The visible label, which is also the accessible name. */
  readonly label: string;
  /** The description under the field: the expected format or what the value is for. */
  readonly hint?: ReactNode;
  /** The message that states the rule and the fix; the field is invalid while it is set. */
  readonly error?: string;
  /** Adds "(optional)" to the label; required fields carry no marker. */
  readonly optional?: boolean;
  readonly type?: 'text' | 'email' | 'tel' | 'url' | 'password';
  readonly className?: string;
}

/**
 * A single-line text input with its label, hint and error on Base UI's Field: the label names the
 * input, the error and then the hint describe it, and aria-invalid follows the error. It takes the
 * props of react-hook-form's register, ref included.
 */
export function TextField({
  label,
  hint,
  error,
  optional = false,
  className,
  type = 'text',
  ...inputProps
}: TextFieldProps) {
  return (
    <Field.Root invalid={error !== undefined} className={cn('flex flex-col gap-1.5', className)}>
      <Field.Label className="text-xs font-semibold text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Field.Label>
      <Field.Control {...inputProps} type={type} className={inputClassName} />
      <Field.Error
        match={error !== undefined}
        className="flex items-start gap-1 text-xs text-destructive"
      >
        <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
        {error}
      </Field.Error>
      {hint !== undefined && (
        <Field.Description className="text-xs text-muted-foreground">{hint}</Field.Description>
      )}
    </Field.Root>
  );
}
