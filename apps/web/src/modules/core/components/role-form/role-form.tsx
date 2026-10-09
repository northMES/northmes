// SPDX-License-Identifier: AGPL-3.0-or-later
import type { updateRole } from '@northmes/core-contracts';
import type { ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import type { z } from 'zod';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldProps, summaryErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import {
  PermissionChecklist,
  type PermissionChecklistProps,
} from '../permission-checklist/index.ts';
import { RoleFormDifference } from './role-form-difference.tsx';

/** The fields of the role form: the name, the permissions and the reason of a change. */
export type RoleFields = typeof updateRole.fields;

/** The values a save receives, as the contract parses them. */
export type RoleValues = z.output<RoleFields>;

export interface RoleFormProps {
  readonly form: ZodForm<RoleFields>;
  /** Sends the values; a failure places its errors on the form before the promise settles. */
  readonly onSave: (values: RoleValues) => Promise<void>;
  /** Where Cancel leads: the roles list for a new role, the role's page for an edit. */
  readonly cancelHref: string;
  /** Create role or Save role. */
  readonly saveLabel: string;
  /** The summary's heading when the save failed without field errors: "Shift lead was not saved". */
  readonly failedHeading: string;
  /** The company the role belongs to, whose roles have unique names. */
  readonly companyName: string;
  /** Set while the last save was refused because the role changed meanwhile. */
  readonly conflict?: { readonly onReload: () => Promise<void> };
  /** Start from on New role, above the checklist. */
  readonly startFrom?: ReactNode;
  /** The role the new role starts from, whose difference the checklist shows. */
  readonly baseline?: { readonly name: string; readonly permissions: readonly string[] };
  /** The edit form asks for the reason of the change. */
  readonly withReason?: boolean;
  /** The permissions the last save was refused for, marked invalid in the checklist. */
  readonly refused?: readonly string[];
  /** The permissions the edited role holds already, which the editor may tick again. */
  readonly current?: readonly string[];
  /** The edited role's name and the places where it is assigned, where an added permission locks. */
  readonly assigned?: PermissionChecklistProps['assigned'];
}

/** The error summary: the version conflict, or the errors of the save. */
function Summary({
  form,
  conflict,
  failedHeading,
}: Pick<RoleFormProps, 'form' | 'conflict' | 'failedHeading'>) {
  const errors = summaryErrors(form.formState.errors);
  if (conflict !== undefined) {
    return <ConflictSummary noun="role" errors={errors} onReload={conflict.onReload} />;
  }
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  const heading =
    fieldCount === 0
      ? failedHeading
      : `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to save the role`;
  return <ErrorSummary heading={heading} errors={errors} focusKey={form.formState.submitCount} />;
}

/**
 * The role form of New role and Edit role (design core-304, RO13 and RO17): the error summary,
 * Role name, Start from on a new role, the permission checklist by module, the reason of a change
 * on an edit, and the sticky Save bar. A refused save keeps every tick, the name and the reason
 * (WCAG 3.3.7), and its summary takes focus. Leaving with changes asks first.
 */
export function RoleForm({
  form,
  onSave,
  cancelHref,
  saveLabel,
  failedHeading,
  companyName,
  conflict,
  startFrom,
  baseline,
  withReason = false,
  refused,
  current,
  assigned,
}: RoleFormProps) {
  const { isDirty, isSubmitting } = form.formState;
  return (
    <form noValidate onSubmit={form.handleSubmit(onSave)} className="flex max-w-190 flex-col gap-4">
      <Summary form={form} conflict={conflict} failedHeading={failedHeading} />
      <FormSection title="Role">
        <TextField
          label="Role name"
          hint={`Unique within ${companyName}.`}
          autoComplete="off"
          className="max-w-120"
          {...fieldProps(form, 'name')}
        />
        {startFrom}
      </FormSection>
      {baseline !== undefined && (
        <RoleFormDifference
          name={form.watch('name') ?? ''}
          baseline={baseline}
          value={form.watch('permissions') ?? []}
        />
      )}
      <FormSection
        title="Permissions"
        description="Grouped by module in the order of the sidebar. Each line says what the permission allows; its id is for docs and support."
      >
        <Controller
          control={form.control}
          name="permissions"
          render={({ field }) => (
            <PermissionChecklist
              value={field.value}
              onChange={field.onChange}
              baseline={baseline}
              refused={refused}
              current={current}
              assigned={assigned}
            />
          )}
        />
      </FormSection>
      {withReason && (
        <FormSection title="Reason for change">
          <TextareaField label="Reason" optional {...fieldProps(form, 'reason')} />
        </FormSection>
      )}
      <FormActions
        saveLabel={saveLabel}
        saving={isSubmitting}
        cancelHref={cancelHref}
        dirty={isDirty}
      />
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
