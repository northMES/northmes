// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { ReadOnlyField } from '../../../../ui/components/read-only-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Field, FieldDescription } from '../../../../ui/primitives/field.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { GroupBand } from '../../components/group-band/index.ts';
import { colorText, colorUsers, machinesOf, paletteColors } from '../../equipment-group-facts.ts';
import { equipmentGroupPageState } from '../../equipment-group-states.tsx';
import type { PlantEquipmentGroup, PlantSettingsSnapshot } from '../../plant-settings-data.ts';
import { equipmentGroupSaveReason } from '../../plant-settings-reasons.ts';
import { equipmentGroupPageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

/** The tag of a field the ERP owns. */
const fromErp = 'From the ERP';

/** The form of a group (EG5): the code, the name, the palette color with a preview, the reason. */
function GroupForm({
  snapshot,
  group,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly group: PlantEquipmentGroup;
}) {
  const { plant } = useShell();
  const imported = group.owner === 'erp';
  const colorId = useId();
  const [color, setColor] = useState(group.color);
  const [name, setName] = useState(group.name);
  const users = colorUsers(snapshot, group);
  const machines = machinesOf(snapshot, group.code);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <FormSection title="Equipment group">
        {group.scope.kind === 'company' && (
          <p className="text-sm">
            {group.code} is a company group: a change here applies at every plant of{' '}
            {group.scope.name}.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField
            label="Code"
            value={group.code}
            tag={imported ? fromErp : 'Set at creation'}
            hint={
              imported
                ? "The ERP's group code identifies the group. It cannot change."
                : 'The code identifies the group. It cannot change.'
            }
          />
          {imported ? (
            <ReadOnlyField
              label="Name"
              value={group.name}
              tag={fromErp}
              hint="The ERP sends the name with the machines."
            />
          ) : (
            <TextField
              label="Name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              hint="Shown beside the color on the board, the Gantt and the machine pages."
            />
          )}
          <Field className="sm:col-span-2">
            <span id={colorId} className="text-xs font-semibold">
              Color
            </span>
            <RadioGroup
              aria-labelledby={colorId}
              aria-describedby={`${colorId}-hint`}
              value={color}
              onValueChange={(value) => setColor(String(value))}
              name="color"
              className="grid grid-cols-5 gap-2 sm:grid-cols-10"
            >
              {paletteColors.map((each) => {
                const usedBy = users.get(each) ?? [];
                // The radio takes its name from the label, "Color 1, used by HEAT", while the
                // swatch shows the number and the codes.
                const name =
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
                    <span className="sr-only">{name}</span>
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
              One of the 20 palette colors. The color you set here stays: the import never replaces
              an existing color. Two groups can share a color; the name tells them apart.
            </FieldDescription>
          </Field>
        </div>
      </FormSection>
      <FormSection title="Preview on the board">
        <GroupBand name={name} color={color} machines={machines} />
      </FormSection>
      <FormSection title="Reason for the change">
        <TextareaField
          label="Reason"
          name="reason"
          optional
          placeholder="Why you made this change"
          hint="Shown in the group's history. Do not enter personal data. Up to 500 characters."
        />
      </FormSection>
      <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
        <Button type="submit" disabled>
          Save equipment group
        </Button>
        <Link
          to={coreLinks.equipmentGroups.group({ plant, groupCode: group.code }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel
        </Link>
        <p className="text-sm text-muted-foreground">{equipmentGroupSaveReason}</p>
      </div>
    </form>
  );
}

/** The form's skeleton while the group loads: two sections of field placeholders. */
function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {['group', 'reason'].map((section) => (
        <div
          key={section}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <Skeleton aria-hidden className="h-4 w-32 rounded-sm bg-accent" />
          <div className="grid gap-4 sm:grid-cols-2">
            {(section === 'group' ? ['code', 'name'] : ['reason']).map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton aria-hidden className="h-3 w-20 rounded-sm bg-accent" />
                <Skeleton aria-hidden className="h-9 w-full rounded-md bg-accent" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">Loading the equipment group.</p>
    </div>
  );
}

/**
 * The edit form of an equipment group in plant settings (design #729, EG5): the code, the name
 * (read-only with the From the ERP tag for a group the ERP sent), the 20 palette colors with the
 * other groups that use each, the band it draws on the board in the name and color entered, and
 * the reason for the change. The form is drawn on the fixture; Save waits for the equipment API.
 * An unknown code shows the not-found state.
 */
export function EditEquipmentGroupScreen() {
  const { plant } = useShell();
  const { groupCode = '' } = useParams({ strict: false });
  const search = equipmentGroupPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlantSettings(search.preview);
  const group = snapshot?.equipmentGroups.find((each) => each.code === groupCode);
  const groupPage = coreLinks.equipmentGroups.group({ plant, groupCode }).href;
  const state = equipmentGroupPageState({
    plant,
    loaded: snapshot !== undefined,
    found: group !== undefined,
    error,
    retry,
    forbiddenAction: (
      <Link to={groupPage} className={buttonVariants({ variant: 'outline' })}>
        Back to equipment group {groupCode}
      </Link>
    ),
  });
  return (
    <PageFrame
      title={`Edit equipment group ${group?.code ?? groupCode}`}
      crumbs={[
        { label: 'Equipment groups', href: coreLinks.equipmentGroups({ plant }).href },
        { label: `Equipment group ${group?.code ?? groupCode}`, href: groupPage },
      ]}
      currentCrumb="Edit"
      meta={
        group === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">{group.name}</span>
        )
      }
      state={state}
    >
      {state.status === 'loading' && <FormSkeleton />}
      {snapshot !== undefined && group !== undefined && (
        // A new group gets a fresh form, so the color and name picked for another never carry over.
        <GroupForm key={group.code} snapshot={snapshot} group={group} />
      )}
    </PageFrame>
  );
}
