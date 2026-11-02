// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { paletteColors, scopeLevel } from '@northmes/contracts';
import { equipmentGroups } from '@northmes/core-contracts';
import { useId } from 'react';
import type { z } from 'zod';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldProps, summaryErrors, type ZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { Field, FieldDescription } from '../../../../ui/primitives/field.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import {
  type ColoredGroup,
  colorText,
  colorUsers,
  firstFreeColor,
} from '../../equipment-group-facts.ts';
import { GroupBand } from '../group-band/index.ts';

/**
 * The fields of the equipment group form: the code, the name and the palette color that create
 * and update share, and the scope a new group takes.
 */
export const equipmentGroupFormFields = equipmentGroups.fields
  .pick({ code: true, name: true, color: true })
  .extend({ scope: scopeLevel.optional() });

/** The values a save receives, trimmed. */
export type EquipmentGroupValues = z.output<typeof equipmentGroupFormFields>;

/** A scope a new group may take: the plant or the company, by name. */
export interface ScopeChoice {
  readonly value: 'company' | 'plant';
  readonly label: string;
}

export interface EquipmentGroupFormProps {
  readonly form: ZodForm<typeof equipmentGroupFormFields>;
  /** Sends the values; a failure places its errors on the form before the promise settles. */
  readonly onSave: (values: EquipmentGroupValues) => Promise<void>;
  /** Where Cancel leads. */
  readonly cancelHref: string;
  /** The active groups the plant sees, for the colors in use and the first free one. */
  readonly groups: readonly ColoredGroup[];
  /**
   * Every page of `groups` is in, so the form may name the free color the API will take; false
   * while they load or after a page failed.
   */
  readonly groupsComplete?: boolean;
  /** The group the form changes; none on the new group page. */
  readonly groupId?: string;
  /** The scopes a new group may take; none on an existing group, whose scope stays. */
  readonly scopes?: readonly ScopeChoice[];
  /**
   * The sentences above the fields: the reach of a change to a company group, or why the form is
   * read-only.
   */
  readonly notes?: readonly string[];
  /** The group's machines at the plant, which the preview of its band draws. */
  readonly machines: readonly { code: string; name: string; isPlannable: boolean }[];
  /** The name the preview shows while Name is blank: the stored one, or none for a new group. */
  readonly storedName?: string;
  /** Set while the last save was refused with core.version_conflict. */
  readonly conflict?: { readonly onReload: () => Promise<void> };
  /** False on a group the user may not change or that is archived. */
  readonly editable?: boolean;
}

/**
 * The equipment group form (design #729, EG5, and the register's create form): the error summary,
 * Code, which an existing group keeps, Name, the Scope of a new group, the 20 palette colors with
 * the other groups that use each, the band the group draws on the board in the name and color
 * entered, and the sticky Save bar. A new group without a picked color takes the first free one,
 * which the hint and the preview name. The summary takes focus after each failed save, the typed
 * values stay, and leaving the form with changes asks first.
 */
export function EquipmentGroupForm({
  form,
  onSave,
  cancelHref,
  groups,
  groupId,
  groupsComplete = true,
  scopes,
  notes = [],
  machines,
  storedName,
  conflict,
  editable = true,
}: EquipmentGroupFormProps) {
  const colorId = useId();
  const scopeId = useId();
  const { isDirty, isSubmitting } = form.formState;
  const errors = summaryErrors(form.formState.errors);
  const fieldCount = errors.filter(({ name }) => name !== undefined).length;
  const isNew = groupId === undefined;
  const color = form.watch('color');
  const scope = form.watch('scope');
  const name = form.watch('name').trim();
  const users = colorUsers(groups, groupId);
  const free = firstFreeColor(groups);
  return (
    <form noValidate onSubmit={form.handleSubmit(onSave)} className="flex flex-col gap-4">
      {conflict === undefined ? (
        <ErrorSummary
          heading={
            fieldCount === 0
              ? 'Could not save the equipment group'
              : `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to save the equipment group`
          }
          errors={errors}
          focusKey={form.formState.submitCount}
        />
      ) : (
        <ConflictSummary noun="equipment group" errors={errors} onReload={conflict.onReload} />
      )}
      <FormSection title="Equipment group">
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
                ? '1 to 32 characters, unique among the groups the plant sees.'
                : 'The code identifies the group. It cannot change.'
            }
            {...fieldProps(form, 'code')}
          />
          <TextField
            label="Name"
            autoComplete="off"
            readOnly={!editable}
            hint="Shown beside the color on the board, the Gantt and the machine pages."
            {...fieldProps(form, 'name')}
          />
          {scopes !== undefined && (
            <Field className="sm:col-span-2">
              <span id={scopeId} className="text-xs font-semibold">
                Scope
              </span>
              <RadioGroup
                aria-labelledby={scopeId}
                aria-describedby={`${scopeId}-hint`}
                value={scope ?? ''}
                onValueChange={(value) =>
                  form.setValue('scope', value === 'company' ? 'company' : 'plant', {
                    shouldDirty: true,
                  })
                }
                name="scope"
                className="flex flex-col gap-2"
              >
                {scopes.map((choice) => (
                  // biome-ignore lint/a11y/noLabelWithoutControl: the radio inside is the control.
                  <label
                    key={choice.value}
                    className="flex min-h-(--nm-target-min) items-center gap-2 text-sm"
                  >
                    <RadioGroupItem value={choice.value} />
                    {choice.label}
                  </label>
                ))}
              </RadioGroup>
              <FieldDescription id={`${scopeId}-hint`}>
                A company group is one every plant of the company may use. The scope cannot change
                later.
              </FieldDescription>
            </Field>
          )}
          <Field className="sm:col-span-2">
            <span id={colorId} className="text-xs font-semibold">
              Color
            </span>
            <RadioGroup
              aria-labelledby={colorId}
              aria-describedby={`${colorId}-hint`}
              value={color ?? ''}
              onValueChange={(value) =>
                form.setValue('color', String(value) as EquipmentGroupValues['color'], {
                  shouldDirty: true,
                })
              }
              disabled={!editable}
              name="color"
              className="grid grid-cols-5 gap-2 sm:grid-cols-10"
            >
              {paletteColors.map((each) => {
                const usedBy = users.get(each) ?? [];
                // The radio takes its name from the label, "Color 1, used by HEAT", while the
                // swatch shows the number and the codes.
                const label =
                  usedBy.length === 0
                    ? colorText(each)
                    : `${colorText(each)}, used by ${usedBy.join(', ')}`;
                return (
                  // biome-ignore lint/a11y/noLabelWithoutControl: the radio inside is the control.
                  <label
                    key={each}
                    className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-transparent p-1 has-data-checked:border-foreground"
                  >
                    <span
                      aria-hidden
                      className="h-8 w-full rounded-sm border border-border"
                      style={{ background: `var(--${each})` }}
                    />
                    <span className="sr-only">{label}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <RadioGroupItem value={each} />
                      <span aria-hidden>{each.replace('palette-', '')}</span>
                    </span>
                    <span aria-hidden className="min-h-4 font-mono text-tick text-muted-foreground">
                      {usedBy.join(', ')}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
            <FieldDescription id={`${colorId}-hint`}>
              {isNew
                ? `One of the 20 palette colors. Pick none and the group takes ${groupsComplete ? `${colorText(free)}, ` : ''}the first palette color that no group uses.`
                : 'One of the 20 palette colors. The color you set here stays: the import never replaces an existing color. Two groups can share a color; the name tells them apart.'}
            </FieldDescription>
          </Field>
        </div>
      </FormSection>
      <FormSection title="Preview on the board">
        {/* A blank Name while typing keeps the stored name beside the color. */}
        <GroupBand
          name={name === '' ? (storedName ?? 'New equipment group') : name}
          color={color ?? free}
          machines={machines}
        />
      </FormSection>
      {editable && (
        <FormActions
          saveLabel="Save equipment group"
          saving={isSubmitting}
          cancelHref={cancelHref}
          dirty={isDirty}
        />
      )}
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}
