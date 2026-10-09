// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { fieldId } from '../../lib/field-id.ts';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../primitives/field.tsx';
import { Textarea } from '../../primitives/textarea.tsx';

export interface TextareaFieldProps extends Omit<ComponentProps<'textarea'>, 'className'> {
  /** The visible label, which is also the accessible name. */
  readonly label: string;
  /** The description under the field. */
  readonly hint?: ReactNode;
  /** The message that states the rule and the fix; the field is invalid while it is set. */
  readonly error?: string;
  /** Adds "(optional)" to the label; required fields carry no marker. */
  readonly optional?: boolean;
  readonly className?: string;
}

/**
 * A multi-line text field with its label, hint and error on shadcn's Field, as TextField is for
 * one line: the reason of a change takes it (design core-304). It takes the props of
 * react-hook-form's register, ref included; with a name and no id, its id is fieldId(name).
 */
export function TextareaField({
  label,
  hint,
  error,
  optional = false,
  className,
  id,
  ...textareaProps
}: TextareaFieldProps) {
  const ownId = useId();
  const inputId = id ?? (textareaProps.name === undefined ? ownId : fieldId(textareaProps.name));
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
      <Textarea
        {...textareaProps}
        id={inputId}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      />
      {error !== undefined && (
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
