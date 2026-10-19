// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { CircleAlert, Lock } from 'lucide-react';
import { useId } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { ReadOnlyField } from '../../../../ui/components/read-only-field/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { GroupColor } from '../../components/group-color/index.ts';
import {
  type PlantMachine,
  PlantSettingsForbidden,
  type PlantSettingsSnapshot,
} from '../../plant-settings-data.ts';
import { groupColorOf, groupNamer } from '../../plant-settings-facts.ts';
import { machineSaveReason } from '../../plant-settings-reasons.ts';
import { machinePageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

/** The tag of a field the ERP owns (design #688, MA4). */
const fromErp = 'From the ERP';

/** The form of a machine (MA4): the ERP's code and plannable flag, and the plant's own fields. */
function MachineForm({
  snapshot,
  machine,
  failed,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly machine: PlantMachine;
  /** The page previews a save that failed (MF3): the entries stay and the alert says so. */
  readonly failed: boolean;
}) {
  const { plant } = useShell();
  const imported = machine.owner === 'erp';
  const plannableId = useId();
  const stripeId = useId();
  const color = groupColorOf(snapshot, machine);
  const groupName = groupNamer(snapshot)(machine.group);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      {failed && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden />
          <AlertTitle>Could not save the machine</AlertTitle>
          <AlertDescription>
            Your entries are kept. Try again; if it fails again, give your plant admin the
            correlation id.
          </AlertDescription>
        </Alert>
      )}
      <FormSection title="Machine">
        <div className="grid gap-4 sm:grid-cols-2">
          {imported ? (
            <ReadOnlyField
              label="Code"
              value={machine.code}
              tag={fromErp}
              hint="The ERP's machine code identifies the machine. It cannot change."
            />
          ) : (
            <ReadOnlyField
              label="Code"
              value={machine.code}
              tag="Set at creation"
              hint="The code identifies the machine. It cannot change."
            />
          )}
          <TextField
            label="Name"
            name="name"
            defaultValue={machine.name}
            hint="Shown on the board, the Gantt and the station."
          />
          <SelectField
            label="Equipment group"
            name="group"
            defaultValue={machine.group}
            options={snapshot.equipmentGroups.map((group) => ({
              value: group.code,
              label: group.name,
            }))}
            hint="The row band on the board. Choose a group or create one under Equipment groups."
          />
          <SelectField
            label="Calendar"
            name="calendar"
            defaultValue={machine.calendar ?? ''}
            placeholder="No calendar"
            options={snapshot.calendars.map((calendar) => ({
              value: calendar.name,
              label: calendar.name,
            }))}
            hint="The plant calendar by default. A machine with its own shift pattern gets its own calendar."
          />
          <Field className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold">Plannable</span>
              {imported && (
                <Badge variant="outline" className="h-4.5 gap-1 px-1.5 text-tick">
                  <Lock aria-hidden className="size-3" />
                  {fromErp}
                </Badge>
              )}
            </div>
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={plannableId}
                name="isPlannable"
                defaultChecked={machine.isPlannable}
                readOnly={imported}
                aria-describedby={`${plannableId}-hint`}
              />
              <FieldLabel htmlFor={plannableId} className="font-normal">
                Plannable: the machine appears on the board and autoplan places job orders on it
              </FieldLabel>
            </Field>
            <FieldDescription id={`${plannableId}-hint`}>
              {imported
                ? 'The ERP sent the plannable flag. Whether a value changed here survives the next import is open with the product owner (plan 07, field ownership).'
                : 'A machine that is not plannable stays off the board.'}
            </FieldDescription>
          </Field>
          <Field className="sm:col-span-2">
            <span id={stripeId} className="text-xs font-semibold">
              Color stripe
            </span>
            <RadioGroup
              aria-labelledby={stripeId}
              defaultValue="group"
              name="stripe"
              className="flex flex-col gap-2"
            >
              <Label className="flex min-h-9 items-center gap-3 font-normal">
                <RadioGroupItem value="group" />
                <GroupColor color={color} shape="stripe" />
                From the group, {groupName}
              </Label>
              <Label className="flex min-h-9 items-center gap-3 font-normal">
                <RadioGroupItem value="own" />
                Own color
              </Label>
            </RadioGroup>
            <FieldDescription>
              The 6 px stripe before the machine name. The name is always written beside it.
            </FieldDescription>
          </Field>
        </div>
      </FormSection>
      <FormSection title="Reason for change">
        <TextareaField
          label="Reason"
          name="reason"
          placeholder="Why you made this change"
          hint="Shown in the machine's history. Do not enter personal data. Up to 500 characters."
        />
      </FormSection>
      <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
        <Button type="submit" disabled>
          Save machine
        </Button>
        <Link
          to={coreLinks.machines.machine({ plant, equipmentId: machine.code }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel
        </Link>
        <p className="text-sm text-muted-foreground">{machineSaveReason}</p>
      </div>
    </form>
  );
}

/** The skeleton's sections, each with the keys of its field placeholders. */
const skeletonSections = [
  { id: 'machine', fields: ['code', 'name', 'group', 'calendar'] },
  { id: 'reason', fields: ['reason'] },
] as const;

/** The form's skeleton while the machine loads (MF1): two sections of field placeholders. */
function FormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      {skeletonSections.map((section) => (
        <div
          key={section.id}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <Skeleton aria-hidden className="h-4 w-32 rounded-sm bg-accent" />
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton aria-hidden className="h-3 w-20 rounded-sm bg-accent" />
                <Skeleton aria-hidden className="h-9 w-full rounded-md bg-accent" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">Loading the machine.</p>
    </div>
  );
}

/**
 * The edit form of a machine in plant settings (E06; design #688, MA4 and MF1 to MF4; ui-222 DE7):
 * the ERP's code and plannable flag read-only with the From the ERP tag, the name, the equipment
 * group, the calendar, the color stripe and the reason for change. The form is drawn on the
 * fixture; Save waits for the equipment API. The preview key opens the loading, failed-save and
 * no-access states; an unknown code shows the not-found state (MF2).
 */
export function EditMachineScreen() {
  const { plant } = useShell();
  const { equipmentId = '' } = useParams({ strict: false });
  const search = machinePageSearch(useSearch({ strict: false }));
  // A failed save keeps the form; the mock source answers the fixture and the form shows the alert.
  const failed = search.preview === 'error';
  const { snapshot, error, retry } = usePlantSettings(failed ? undefined : search.preview);
  const machine = snapshot?.equipment.find((each) => each.code === equipmentId);
  const machinePage = coreLinks.machines.machine({ plant, equipmentId }).href;
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof PlantSettingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to change machines at this plant',
      description: `Ask your plant admin for a role that can change machines. You can read machine ${equipmentId} but not edit it.`,
      action: (
        <Link to={machinePage} className={buttonVariants({ variant: 'outline' })}>
          Back to machine {equipmentId}
        </Link>
      ),
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the machine', error, onRetry: retry };
  } else if (snapshot !== undefined && machine === undefined) {
    state = {
      status: 'empty',
      title: 'This machine does not exist or you cannot see it',
      description:
        'The link may be out of date, or the machine belongs to a plant you have no role in.',
      action: (
        <Link
          to={coreLinks.machines({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Machines
        </Link>
      ),
    };
  }
  const loaded = snapshot !== undefined && machine !== undefined;
  const loading = snapshot === undefined && error === undefined;
  return (
    <PageFrame
      title={machine === undefined ? 'Edit machine' : `Edit machine ${machine.code}`}
      crumbs={[
        { label: 'Machines', href: coreLinks.machines({ plant }).href },
        ...(machine === undefined ? [] : [{ label: `Machine ${machine.code}`, href: machinePage }]),
      ]}
      currentCrumb="Edit"
      meta={
        loaded ? (
          <span className="text-sm text-muted-foreground">
            {machine.name}, {groupNamer(snapshot)(machine.group)}
          </span>
        ) : undefined
      }
      state={state}
    >
      {loading && <FormSkeleton />}
      {loaded && <MachineForm snapshot={snapshot} machine={machine} failed={failed} />}
    </PageFrame>
  );
}
