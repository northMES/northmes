// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { fieldId } from '../../lib/field-id.ts';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../primitives/field.tsx';
import { Input } from '../../primitives/input.tsx';

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
 * A single-line text input with its label, hint and error on shadcn's Field: the label names the
 * input, the error and then the hint describe it, and aria-invalid follows the error. It takes the
 * props of react-hook-form's register, ref included; with a name and no id, the input's id is
 * fieldId(name).
 */
export function TextField({
  label,
  hint,
  error,
  optional = false,
  className,
  type = 'text',
  id,
  ...inputProps
}: TextFieldProps) {
  const ownId = useId();
  const inputId = id ?? (inputProps.name === undefined ? ownId : fieldId(inputProps.name));
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error === undefined ? '' : errorId, hint === undefined ? '' : hintId]
    .filter((part) => part !== '')
    .join(' ');
  return (
    <Field data-invalid={error !== undefined || undefined} className={className}>
      <FieldLabel htmlFor={inputId} className="block text-xs font-semibold text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </FieldLabel>
      <Input
        {...inputProps}
        id={inputId}
        type={type}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      />
      {error !== undefined && (
        // The error summary announces a failed submit and takes focus, so the field's own error
        // is not a second alert: role none replaces the role alert of shadcn's FieldError.
        <FieldError id={errorId} role="none" className="flex items-start gap-1 text-xs">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </FieldError>
      )}
      {hint !== undefined && (
        <FieldDescription id={hintId} className="text-xs">
          {hint}
        </FieldDescription>
      )}
    </Field>
  );
}
