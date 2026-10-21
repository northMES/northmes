// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime, formatPlantDay } from '@northmes/contracts/format';
import { useSearch } from '@tanstack/react-router';
import { Info, Lock } from 'lucide-react';
import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { ReadOnlyField } from '../../../../ui/components/read-only-field/index.ts';
import { SelectField } from '../../../../ui/components/select-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import { PlantSettingsForbidden, type PlantSettingsSnapshot } from '../../plant-settings-data.ts';
import { machineNamer } from '../../plant-settings-facts.ts';
import { plantSaveReason } from '../../plant-settings-reasons.ts';
import { plantPageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { nextUnevenProductionDay, productionDayStartClash } from '../../production-day-start.ts';

/** The tag of a field that is set once and cannot change on this page. */
const fixed = 'Fixed';

/** A plant date in another year than now's, with its year: "Sat 27 Mar 2027". */
function dayWithYear(date: string): string {
  return `${formatPlantDay(date)} ${date.slice(0, 4)}`;
}

/**
 * The error of a production day start that is not "HH:MM" or that the zone skips or repeats
 * within 10 years of the plant's today (ADR 0025), the earlier clock change first; undefined when
 * the time is safe.
 */
function dayStartError(timeZone: string, value: string, today: string): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return 'Enter the production day start as HH:MM, such as 06:00.';
  }
  const clash = productionDayStartClash(timeZone, value, today);
  if (clash === undefined) return undefined;
  const parts = [
    ...(clash.skipped === undefined
      ? []
      : [{ date: clash.skipped, text: `is skipped on ${dayWithYear(clash.skipped)}` }]),
    ...(clash.repeated === undefined
      ? []
      : [{ date: clash.repeated, text: `occurs twice on ${dayWithYear(clash.repeated)}` }]),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return `${value} ${parts.map((part) => part.text).join(' and ')} in ${timeZone}. Choose a time outside the hour the clocks change.`;
}

/** The production day facts of a plant whose day start is fixed: today's day and the next uneven one. */
function ProductionDayFacts({ snapshot }: { readonly snapshot: PlantSettingsSnapshot }) {
  const { timeZone, productionDayStart } = snapshot.plant;
  const start = Temporal.PlainTime.from(productionDayStart);
  const now = Temporal.Instant.fromEpochMilliseconds(snapshot.nowMs).toZonedDateTimeISO(timeZone);
  const today =
    Temporal.PlainTime.compare(now.toPlainTime(), start) < 0
      ? now.toPlainDate().subtract({ days: 1 })
      : now.toPlainDate();
  const begins = today.toPlainDateTime(start).toZonedDateTime(timeZone).epochMilliseconds;
  const ends = today
    .add({ days: 1 })
    .toPlainDateTime(start)
    .toZonedDateTime(timeZone).epochMilliseconds;
  const uneven = nextUnevenProductionDay(timeZone, productionDayStart, snapshot.nowMs);
  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p>
        The production day of {formatPlantDay(today.toString())} runs from{' '}
        {formatPlantDateTime(begins, timeZone)} to {formatPlantDateTime(ends, timeZone)}.
      </p>
      {uneven !== undefined && (
        <p>
          The production day of {dayWithYear(uneven.date)} lasts {uneven.hours} h, because the
          clocks {uneven.hours < 24 ? 'go forward' : 'go back'} that night.
        </p>
      )}
    </div>
  );
}

/** The zone and the day start of a plant without a calendar version: both may still change. */
function OpenTimeFields({ snapshot }: { readonly snapshot: PlantSettingsSnapshot }) {
  const [timeZone, setTimeZone] = useState(snapshot.plant.timeZone);
  const [dayStart, setDayStart] = useState(snapshot.plant.productionDayStart);
  const [checked, setChecked] = useState<string | undefined>(undefined);
  const today = Temporal.Instant.fromEpochMilliseconds(snapshot.nowMs)
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
  const check = (zone: string, value: string) => setChecked(dayStartError(zone, value, today));
  return (
    <>
      <SelectField
        label="Time zone"
        name="timeZone"
        value={timeZone}
        onChange={(event) => {
          setTimeZone(event.target.value);
          check(event.target.value, dayStart);
        }}
        options={Intl.supportedValuesOf('timeZone').map((zone) => ({ value: zone, label: zone }))}
        hint="An IANA zone from the server's list, the same list as New plant in company settings."
      />
      <TextField
        label="Production day start"
        name="productionDayStart"
        value={dayStart}
        inputMode="numeric"
        onChange={(event) => setDayStart(event.target.value)}
        onBlur={() => check(timeZone, dayStart)}
        error={checked}
        hint="Plant time, HH:MM. A night shift belongs to the production day it starts on. The time is checked against the zone's clock changes for the next 10 years."
      />
    </>
  );
}

/** The plant's form (PP1, PP4): the name, the fixed slug, the zone and the day start, the facts. */
function PlantForm({ snapshot }: { readonly snapshot: PlantSettingsSnapshot }) {
  const calendar = snapshot.calendars[0];
  const plannable = snapshot.equipment.filter((machine) => machine.isPlannable);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <FormSection title="Plant">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            name="name"
            defaultValue={snapshot.plant.name}
            hint="Shown in the plant switcher, the crumbs and every document title."
          />
          <ReadOnlyField
            label="Slug"
            value={snapshot.plant.slug}
            tag={fixed}
            hint="Set when the plant was created under Plants in company settings. It is unique in the installation and is in every address of the plant. Whether it can be renamed is still open (E05-S03)."
          />
        </div>
      </FormSection>
      <FormSection title="Time zone and production day">
        {calendar !== undefined && (
          <Alert>
            <Lock aria-hidden />
            <AlertTitle>Fixed since calendar {calendar.name}'s first version</AlertTitle>
            <AlertDescription>
              Calendar {calendar.name} has a version from {dayWithYear(calendar.effectiveFrom)}.
              Calendar versions and the order times from the ERP are read in the plant's zone, so
              the zone and the day start stay as they are once a calendar version exists (ADR 0066).
              Whether the day start may change later is open with the product owner (ADR 0025).
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {calendar === undefined ? (
            <OpenTimeFields snapshot={snapshot} />
          ) : (
            <>
              <ReadOnlyField
                label="Time zone"
                value={snapshot.plant.timeZone}
                tag={fixed}
                hint="The plant's clock, an IANA zone."
              />
              <ReadOnlyField
                label="Production day start"
                value={snapshot.plant.productionDayStart}
                tag={fixed}
                hint="Plant time. A night shift belongs to the production day it starts on."
              />
            </>
          )}
        </div>
        {calendar === undefined ? (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>No calendar version yet</AlertTitle>
            <AlertDescription>
              You can change the zone and the day start until the plant has its first calendar
              version. The onboarding's plant step shows these fields again for review.
            </AlertDescription>
          </Alert>
        ) : (
          <ProductionDayFacts snapshot={snapshot} />
        )}
      </FormSection>
      <FormSection title="Facts">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Calendar</dt>
            <dd>
              {calendar === undefined
                ? 'None yet'
                : `${calendar.name}, version from ${dayWithYear(calendar.effectiveFrom)}`}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Plannable machines</dt>
            <dd>
              {plannable.length === 0
                ? 'None yet'
                : `${plannable.length}: ${plannable.map((machine) => machineNamer(snapshot)(machine.code)).join(', ')}`}
            </dd>
          </div>
        </dl>
      </FormSection>
      <FormSection title="Reason for change">
        <TextareaField
          label="Reason"
          name="reason"
          optional
          hint="Shown in the plant's history. Do not enter personal data. Up to 500 characters."
        />
      </FormSection>
      <div className="flex flex-wrap items-center gap-2 border-t border-border py-3">
        <Button type="submit" disabled>
          Save plant
        </Button>
        <p className="text-sm text-muted-foreground">{plantSaveReason}</p>
        {snapshot.fixture !== undefined && (
          <p className="text-sm text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
        )}
      </div>
    </form>
  );
}

/** The form's skeleton while the plant loads (PP5). */
function FormSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      {['plant', 'time'].map((section) => (
        <div
          key={section}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <Skeleton aria-hidden className="h-4 w-32 rounded-sm bg-accent" />
          <div className="grid gap-4 sm:grid-cols-2">
            {['first', 'second'].map((field) => (
              <div key={field} className="flex flex-col gap-2">
                <Skeleton aria-hidden className="h-3 w-20 rounded-sm bg-accent" />
                <Skeleton aria-hidden className="h-9 w-full rounded-md bg-accent" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">Loading the plant.</p>
    </div>
  );
}

/**
 * The plant's own page in plant settings (design #767, PP1 to PP7): its name, its slug, and its
 * zone and production day start, which are fixed once the plant has a calendar version (ADR 0066)
 * and checked against the zone's clock changes before (ADR 0025). The fields and checks are those
 * of New plant in company settings (#419). The page reads the fixture G1; Save waits for the plant
 * API. The preview key opens the plant without a calendar version (PP4) and the loading, failed
 * and no-access states.
 */
export function PlantScreen() {
  const search = plantPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlantSettings(search.preview);
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof PlantSettingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to change this plant',
      description: 'Ask your plant admin for a role that can change the plant.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the plant', error, onRetry: retry };
  }
  const loading = snapshot === undefined && error === undefined;
  return (
    <PageFrame title={snapshot?.plant.name ?? 'Plant'} currentCrumb="Plant" state={state}>
      {loading && <FormSkeleton />}
      {snapshot !== undefined && <PlantForm snapshot={snapshot} />}
    </PageFrame>
  );
}
