// SPDX-License-Identifier: AGPL-3.0-or-later
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  type FieldPath,
  type FieldValues,
  type UseFormProps,
  type UseFormRegisterReturn,
  type UseFormReturn,
  useForm,
} from 'react-hook-form';
import type { z } from 'zod';

/** A form whose values are the input of a Zod schema and whose submit receives its output. */
export type ZodForm<TSchema extends z.ZodType<unknown, FieldValues>> = UseFormReturn<
  z.input<TSchema>,
  unknown,
  z.output<TSchema>
>;

/**
 * react-hook-form 7 bound to a Zod schema through the Standard Schema resolver (ADRs 0017, 0020):
 * the schema validates on submit and again on each change after a submit, and handleSubmit hands
 * its output to the save. Field names are the schema paths joined with dots. A failed submit leaves
 * focus where it is, because the error summary takes it.
 */
export function useZodForm<TSchema extends z.ZodType<unknown, FieldValues>>(
  schema: TSchema,
  options: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, 'resolver'> = {},
): ZodForm<TSchema> {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    shouldFocusError: false,
    ...options,
    resolver: standardSchemaResolver(schema),
  });
}

/** The register props of a field plus the message of its error, for TextField and its kin. */
export function fieldProps<TValues extends FieldValues>(
  form: UseFormReturn<TValues, unknown, unknown>,
  name: FieldPath<TValues>,
): UseFormRegisterReturn<FieldPath<TValues>> & { readonly error: string | undefined } {
  return {
    ...form.register(name),
    error: form.getFieldState(name, form.formState).error?.message,
  };
}

/** One entry of `extensions.fieldErrors`, from a Zod parse or a DomainError (ADR 0017). */
export interface ServerFieldError {
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly code?: string;
}

/**
 * Places a server's fieldErrors (ADRs 0017 and 0062): an entry whose path, joined with dots, names
 * a registered field becomes that field's error; every other entry goes to `root.server`, one
 * message per line as the Standard Schema resolver writes root issues, for the error summary. The
 * typed values stay.
 */
export function setServerErrors<TValues extends FieldValues>(
  form: UseFormReturn<TValues, unknown, unknown>,
  fieldErrors: readonly ServerFieldError[],
): void {
  // react-hook-form keeps the names of registered fields, from register and Controller alike, in
  // control._names.mount; its public API has no other way to ask whether a field is registered.
  const registered = form.control._names.mount;
  const unplaced: string[] = [];
  for (const { path, message, code } of fieldErrors) {
    const name = path.join('.');
    if (name !== '' && registered.has(name)) {
      form.setError(name as FieldPath<TValues>, { type: code ?? 'server', message });
    } else {
      unplaced.push(message);
    }
  }
  if (unplaced.length > 0) {
    form.setError('root.server', { type: 'server', message: unplaced.join('\n') });
  }
}
