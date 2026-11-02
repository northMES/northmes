// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { equipment } from '@northmes/core-contracts';
import { useId } from 'react';
import { z } from 'zod';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldProps, summaryErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import { GroupColor } from '../group-color/index.ts';
import { PalettePicker } from '../palette-picker/index.ts';

/**
 * The fields of the machine form: the code, the name, the equipment group, the plannable flag and
 * the color stripe that create and update share, with the group asked for in words.
 */
export const machineFormFields = equipment.fields
  .pick({ code: true, name: true, groupId: true, isPlannable: true, color: true })
  .extend({ groupId: z.uuid({ error: 'Choose the equipment group of the machine.' }) });

/** The values a save receives, trimmed. */
export type MachineValues = z.output<typeof machineFormFields>;

/** An equipment group the machine may join, as the group field offers it. */
export interface MachineFormGroup {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly color: string;
}

export interface MachineFormProps {
  readonly form: ZodForm<typeof machineFormFields>;
  /** Sends the values; a failure places its errors on the form before the promise settles. */
  readonly onSave: (values: MachineValues) => Promise<void>;
  /** Where Cancel leads. */
  readonly cancelHref: string;
  /** The groups the machine may join: the active ones the plant sees, and the machine's own. */
  readonly groups: readonly MachineFormGroup[];
  /** True on the new machine page, where the code is typed; an existing machine keeps it. */
  readonly isNew?: boolean;
  /** The sentences above the fields, such as why the form is read-only. */
  readonly notes?: readonly string[];
  /** Set while the last save was refused with core.version_conflict. */
  readonly conflict?: { readonly onReload: () => Promise<void> };
  /** False on a machine the user may not change or that is archived. */
  readonly editable?: boolean;
}

/**
 * The machine form (design #688, MA4): the error summary, Code, which an existing machine keeps,
 * Name, the Equipment group, Plannable and the Color stripe, from the group or one of the 20
 * palette colors, and the sticky Save bar. The summary takes focus after each failed save, the
 * typed values stay, and leaving the form with changes asks first.
 */
export function MachineForm({
  form,
  onSave,
  cancelHref,
  groups,
  isNew = false,
  notes = [],
  conflict,
  editable = true,
}: MachineFormProps) {
  const plannableId = useId();
  const stripeId = useId();
  const ownId = useId();
  const { isDirty, isSubmitting } = form.formState;
  const errors = summaryErrors(form.formState.errors);
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  const color = form.watch('color');
  const group = groups.find((each) => each.id === form.watch('groupId'));
  const own = color !== undefined && color !== 'group' ? color : undefined;
  return (
    <form noValidate onSubmit={form.handleSubmit(onSave)} className="flex flex-col gap-4">
      {conflict === undefined ? (
        <ErrorSummary
          heading={
            fieldCount === 0
              ? 'Could not save the machine'
              : `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to save the machine`
          }
          errors={errors}
          focusKey={form.formState.submitCount}
        />
      ) : (
        <ConflictSummary noun="machine" errors={errors} onReload={conflict.onReload} />
      )}
      <FormSection title="Machine">
        {notes.map((note) => (
          <p key={note} className="text-sm">
            {note}
          </p>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Code"
            autoComplete="off"
            readOnly={!isNew || !editable}
            hint={
              isNew
                ? "1 to 32 characters, unique among the plant's machines."
                : 'The code identifies the machine. It cannot change.'
            }
            {...fieldProps(form, 'code')}
          />
          <TextField
            label="Name"
            autoComplete="off"
            readOnly={!editable}
            hint="Shown on the board, the Gantt and the station."
            {...fieldProps(form, 'name')}
          />
          <SelectField
            label="Equipment group"
            placeholder="Choose a group"
            disabled={!editable}
            options={groups.map((each) => ({
              value: each.id,
              label: `${each.name} (${each.code})`,
            }))}
            hint="The row band on the board. Choose a group or create one under Equipment groups."
            {...fieldProps(form, 'groupId')}
          />
          <Field className="sm:col-span-2">
            <span className="text-xs font-semibold">Plannable</span>
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={plannableId}
                checked={form.watch('isPlannable') ?? true}
                onCheckedChange={(checked) =>
                  form.setValue('isPlannable', checked, { shouldDirty: true })
                }
                disabled={!editable}
                aria-describedby={`${plannableId}-hint`}
              />
              <FieldLabel htmlFor={plannableId} className="font-normal">
                Plannable: the machine appears on the board and autoplan places job orders on it
              </FieldLabel>
            </Field>
            <FieldDescription id={`${plannableId}-hint`}>
              Autoplan places no job order on a machine that is not plannable. It stays off the
              board unless its OEE is measured.
            </FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <span id={stripeId} className="text-xs font-semibold">
              Color stripe
            </span>
            <RadioGroup
              aria-labelledby={stripeId}
              aria-describedby={`${stripeId}-hint`}
              value={own === undefined ? 'group' : 'own'}
              onValueChange={(value) =>
                form.setValue(
                  'color',
                  // Own color starts on the group's, so the stripe looks the same until a pick.
                  value === 'own'
                    ? ((group?.color ?? 'palette-1') as MachineValues['color'])
                    : 'group',
                  { shouldDirty: true },
                )
              }
              disabled={!editable}
              className="flex flex-col gap-2"
            >
              <Label className="flex min-h-(--nm-target-min) items-center gap-3 font-normal">
                <RadioGroupItem value="group" />
                <GroupColor color={group?.color} shape="stripe" />
                {group === undefined ? 'From the group' : `From the group, ${group.name}`}
              </Label>
              <Label className="flex min-h-(--nm-target-min) items-center gap-3 font-normal">
                <RadioGroupItem value="own" />
                Own color
              </Label>
            </RadioGroup>
            <FieldDescription id={`${stripeId}-hint`}>
              The 6 px stripe before the machine name. The name is always written beside it.
            </FieldDescription>
          </Field>
          {own !== undefined && (
            <Field className="sm:col-span-2">
              <span id={ownId} className="text-xs font-semibold">
                Own color
              </span>
              <PalettePicker
                name="color"
                labelledBy={ownId}
                value={own}
                onChange={(picked) => form.setValue('color', picked, { shouldDirty: true })}
                disabled={!editable}
              />
            </Field>
          )}
        </div>
      </FormSection>
      {editable && (
        <FormActions
          saveLabel="Save machine"
          saving={isSubmitting}
          cancelHref={cancelHref}
          dirty={isDirty}
        />
      )}
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
