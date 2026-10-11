// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../../../../ui/primitives/combobox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import type { AssignPerson } from './assign-role-form-fields.tsx';

/** The pause in typing after which Person searches, as the list search fields do. */
const searchDelay = 300;

/** The people Person offers for the text typed, which the page reads from the API. */
export interface PersonSearch {
  /** The people that match the last search, or the first ones before a search. */
  readonly results: readonly AssignPerson[];
  /** Asks the page for the people that match the text; '' asks for the first ones. */
  readonly onSearch: (text: string) => void;
}

interface PersonPickerProps extends PersonSearch {
  readonly value: AssignPerson | undefined;
  readonly onChange: (person: AssignPerson | undefined) => void;
  readonly error?: string;
}

/**
 * Person on People's Add role (design core-304, AS3): a combobox that searches the users of the
 * company by name or username as the user types, after a pause, so any user can be found, not
 * only the first page. Each option shows the name and the username, so two people with one name
 * are told apart, and a blocked user carries Blocked.
 */
export function AssignRoleFormPerson({
  results,
  onSearch,
  value,
  onChange,
  error,
}: PersonPickerProps) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const people = new Map(results.map((each) => [each.id, each] as const));
  if (value !== undefined) people.set(value.id, value);
  const inputId = fieldId('userId');
  const errorId = `${inputId}-error`;
  return (
    <Field className="max-w-120" data-invalid={error !== undefined || undefined}>
      <FieldLabel htmlFor={inputId} className="block text-xs font-semibold text-foreground">
        Person
      </FieldLabel>
      <Combobox
        items={results.map(({ id }) => id)}
        value={value?.id ?? null}
        // The API searches; the list shows what it answered.
        filter={null}
        itemToStringLabel={(id: string) => people.get(id)?.name ?? ''}
        onValueChange={(id) => onChange(typeof id === 'string' ? people.get(id) : undefined)}
        onInputValueChange={(text, details) => {
          if (details.reason !== 'input-change') return;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(text.trim()), searchDelay);
        }}
      >
        <ComboboxInput
          id={inputId}
          placeholder="Search by name or username"
          className="w-full"
          aria-invalid={error !== undefined || undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        />
        <ComboboxContent>
          <ComboboxEmpty>Nobody of the company matches.</ComboboxEmpty>
          <ComboboxList>
            {(id: string) => {
              const each = people.get(id);
              if (each === undefined) return null;
              return (
                <ComboboxItem key={id} value={id}>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span>{each.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{each.username}</span>
                    {each.blocked === true && <StatusBadge tone="destructive">Blocked</StatusBadge>}
                  </span>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error !== undefined && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </Field>
  );
}
