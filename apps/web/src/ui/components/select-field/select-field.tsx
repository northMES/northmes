// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { CircleAlert } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { fieldId } from '../../lib/field-id.ts';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../primitives/field.tsx';
import { NativeSelect, NativeSelectOption } from '../../primitives/native-select.tsx';

/** One choice of a SelectField: the value it submits and the text it shows. */
export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps
  extends Omit<ComponentProps<'select'>, 'className' | 'children' | 'size'> {
  /** The visible label, which is also the accessible name. */
  readonly label: string;
  readonly options: readonly SelectFieldOption[];
  /** The first option, with the value "", which a field starts on until a choice is made. */
  readonly placeholder?: string;
  /** The description under the field. */
  readonly hint?: ReactNode;
  /** The message that states the rule and the fix; the field is invalid while it is set. */
  readonly error?: string;
  /** Adds "(optional)" to the label; required fields carry no marker. */
  readonly optional?: boolean;
  readonly className?: string;
}

/**
 * A choice from a short fixed list with its label, hint and error on shadcn's Field, as TextField
 * is for text: the stock unit of an article (design ui-222, DE7). It is the browser's own select,
 * so it opens as the platform's list and takes the props of react-hook-form's register, ref
 * included; with a name and no id, its id is fieldId(name).
 */
export function SelectField({
  label,
  options,
  placeholder,
  hint,
  error,
  optional = false,
  className,
  id,
  ...selectProps
}: SelectFieldProps) {
  const ownId = useId();
  const selectId = id ?? (selectProps.name === undefined ? ownId : fieldId(selectProps.name));
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const describedBy = [error === undefined ? '' : errorId, hint === undefined ? '' : hintId]
    .filter((part) => part !== '')
    .join(' ');
  return (
    <Field data-invalid={error !== undefined || undefined} className={className}>
      <FieldLabel htmlFor={selectId} className="block text-xs font-semibold text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </FieldLabel>
      <NativeSelect
        {...selectProps}
        id={selectId}
        className="w-full"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
      >
        {placeholder !== undefined && (
          <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        )}
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error !== undefined && (
        // The error summary announces a failed submit and takes focus, as for TextField.
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
