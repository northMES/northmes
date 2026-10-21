// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Lock } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { Badge } from '../../primitives/badge.tsx';
import { Field, FieldDescription, FieldLabel } from '../../primitives/field.tsx';
import { Input } from '../../primitives/input.tsx';

export interface ReadOnlyFieldProps {
  /** The visible label, which is also the accessible name. */
  readonly label: string;
  readonly value: string;
  /** The description under the field: where the value comes from and what changes it. */
  readonly hint: ReactNode;
  /** The tag beside the label that names the owner of the value, such as "From the ERP". */
  readonly tag: string;
}

/**
 * A field another system owns on a form (design #686 PO5 and #688 MA4, the From the ERP tag):
 * read-only on the muted surface, with the owner's tag beside its label, so the person sees what
 * the next import changes and what stays theirs.
 */
export function ReadOnlyField({ label, value, hint, tag }: ReadOnlyFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor={id} className="block text-xs font-semibold text-foreground">
          {label}
        </FieldLabel>
        <Badge variant="outline" className="h-4.5 gap-1 px-1.5 text-tick">
          <Lock aria-hidden className="size-3" />
          {tag}
        </Badge>
      </div>
      <Input
        id={id}
        readOnly
        aria-readonly
        value={value}
        aria-describedby={hintId}
        className="bg-muted"
      />
      <FieldDescription id={hintId}>{hint}</FieldDescription>
    </Field>
  );
}
