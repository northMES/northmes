// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDay } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import {
  type PlantCalendar,
  type PlantCalendarDeviation,
  PlantSettingsForbidden,
  type PlantSettingsSnapshot,
  type PlantShift,
} from '../../plant-settings-data.ts';
import {
  calendarDay,
  daysOf,
  hoursText,
  machineNamer,
  type PlantWeek,
  plantTime,
  shiftedWeek,
  weekdayName,
  weeklyWorkingSeconds,
  weekOf,
} from '../../plant-settings-facts.ts';
import { plantSettingsActionReason } from '../../plant-settings-reasons.ts';
import { calendarPageSearch } from '../../plant-settings-search.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';
import { plantSettingsForbiddenState } from '../../plant-settings-states.ts';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';

/** The pixels of one hour in the week view, and the hour the view starts at (design #688, CA1). */
const hourPx = 36;

/**
 * The edge and fill of each shift by its order in the calendar version (#770): a fourth shift
 * starts over at the first color, and its name stays written in each block and in the legend.
 */
const shiftColors = [
  'border-shift-1 bg-shift-1-subtle',
  'border-shift-2 bg-shift-2-subtle',
  'border-shift-3 bg-shift-3-subtle',
] as const;

function shiftColor(order: number): string {
  return shiftColors[order % shiftColors.length] ?? shiftColors[0];
}

/** "Early 06:00 to 14:00": a shift's name and times. */
function shiftLabel(shift: PlantShift): string {
  return `${shift.name} ${shift.start} to ${shift.end}`;
}

/** "Early 06:00 to 14:00" with the name in semibold and the times in mono, as in design #770. */
function ShiftName({ shift }: { readonly shift: PlantShift }) {
  return (
    <span>
      <span className="font-semibold">{shift.name}</span>{' '}
      <span className="font-mono">
        {shift.start} to {shift.end}
      </span>
    </span>
  );
}

/** A shift's color key in the pattern table and the legend, beside its written name. */
function ShiftKey({ order }: { readonly order: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-3.5 shrink-0 rounded-[3px] border', shiftColor(order))}
    />
  );
}

/** A section of the page: a card named by its h2, with a line under the heading. */
function Section({
  title,
  lead,
  action,
  className,
  children,
}: {
  readonly title: string;
  readonly lead?: ReactNode;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {lead !== undefined && <p className="text-sm text-muted-foreground">{lead}</p>}
      {children}
    </section>
  );
}

/** "06:00" as hours since midnight, 6. */
function hoursOf(clock: string): number {
  const [hours = 0, minutes = 0] = clock.split(':').map(Number);
  return hours + minutes / 60;
}

/** The clock of a plant-local instant, "2026-11-07T06:00" to "06:00". */
function clockOf(local: string): string {
  return local.slice(11, 16);
}

/** The plant date of a plant-local instant. */
function dateOf(local: string): string {
  return local.slice(0, 10);
}

/** Whether a deviation covers a whole plant day, midnight to midnight. */
function wholeDay(deviation: PlantCalendarDeviation): boolean {
  return clockOf(deviation.startsLocal) === '00:00' && clockOf(deviation.endsLocal) === '00:00';
}

/** The Shift pattern section (CA1): one row per weekday with its shifts, and the working time per week. */
function PatternSection({ calendar }: { readonly calendar: PlantCalendar }) {
  return (
    <Section
      title="Shift pattern"
      lead={`Version in effect since ${formatPlantDay(calendar.effectiveFrom)}, ${
        calendar.cycleWeeks === 1 ? 'one-week' : `${calendar.cycleWeeks}-week`
      } cycle anchored on Mondays.${
        calendar.shifts.length > 1
          ? ` ${countWord(calendar.shifts.length, true)} shifts: ${listText(calendar.shifts.map((shift) => shift.name))}.`
          : ''
      } A version in effect cannot change; a correction is a new version with an effective date.`}
      action={
        <Button variant="outline" className="h-8 px-3" disabled>
          New version
        </Button>
      }
    >
      <Table>
        <TableCaption className="sr-only">Shift pattern of {calendar.name}</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            {['Weekday', 'Shifts', 'Breaks'].map((label) => (
              <TableHead key={label} scope="col" className={head}>
                {label}
              </TableHead>
            ))}
            <TableHead scope="col" className={cn(head, 'text-end')}>
              Working time
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const shifts = calendar.shifts
              .map((shift, order) => ({ shift, order }))
              .filter(({ shift }) => shift.weekdays.includes(weekday));
            const work = shifts.reduce((sum, { shift }) => sum + shift.workingSeconds, 0);
            return (
              <TableRow key={weekday}>
                <TableCell className={cn(cell, 'align-top')}>{weekdayName(weekday)}</TableCell>
                <TableCell className={cn(cell, 'align-top')}>
                  {shifts.length === 0 ? (
                    <span className="text-muted-foreground">Closed</span>
                  ) : (
                    <span className="flex flex-col gap-1.5">
                      {shifts.map(({ shift, order }) => (
                        <span key={order} className="flex items-center gap-2">
                          <ShiftKey order={order} />
                          <ShiftName shift={shift} />
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn(cell, 'align-top font-mono')}>
                  {shifts.length > 0 && (
                    <span className="flex flex-col gap-1.5">
                      {shifts.map(({ shift, order }) => (
                        <span key={order} className="leading-5">
                          {/* Each line names its shift for a page reader; the lines line up with the shifts beside them. */}
                          <span className="sr-only">{shift.name}: </span>
                          {shift.breaks.length === 0 ? (
                            <span className="font-sans text-muted-foreground">No breaks</span>
                          ) : (
                            shift.breaks.map((each) => `${each.start} to ${each.end}`).join(', ')
                          )}
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn(cell, 'text-end align-top font-mono')}>
                  {shifts.length === 0 ? '0 min' : hoursText(work)}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted hover:bg-muted">
            <TableCell colSpan={3} className={cn(cell, 'font-medium')}>
              Per week
            </TableCell>
            <TableCell className={cn(cell, 'text-end font-mono font-semibold')}>
              {hoursText(weeklyWorkingSeconds(calendar))}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Section>
  );
}

/** The Deviations section (CA1): the dated exceptions with their reasons. */
function DeviationsSection({
  snapshot,
  calendar,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly calendar: PlantCalendar;
}) {
  const machineName = machineNamer(snapshot);
  return (
    <Section
      title="Deviations"
      lead="Dated exceptions to the pattern. A machine's deviation wins over a plant-wide one; within one scope non-working wins over overtime (ADR 0025)."
      action={
        <Button variant="outline" className="h-8 px-3" disabled>
          <Plus aria-hidden />
          New deviation
        </Button>
      }
    >
      {calendar.deviations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deviations.</p>
      ) : (
        <Table>
          <TableCaption className="sr-only">Deviations of {calendar.name}</TableCaption>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              {['Date', 'Kind', 'Applies to', 'Reason'].map((label) => (
                <TableHead key={label} scope="col" className={head}>
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {calendar.deviations.map((deviation) => (
              <TableRow key={deviation.id}>
                <TableCell className={cn(cell, 'font-mono')}>
                  <span className="flex flex-col">
                    <span>{formatPlantDay(dateOf(deviation.startsLocal))}</span>
                    <span className="text-xs text-muted-foreground">
                      {wholeDay(deviation)
                        ? 'All day'
                        : `${clockOf(deviation.startsLocal)} to ${clockOf(deviation.endsLocal)}`}
                    </span>
                  </span>
                </TableCell>
                <TableCell className={cell}>
                  {deviation.kind === 'overtime' ? (
                    <StatusBadge tone="success">Overtime</StatusBadge>
                  ) : (
                    <StatusBadge tone="destructive">Non-working</StatusBadge>
                  )}
                </TableCell>
                <TableCell className={cell}>
                  {deviation.equipment === undefined
                    ? 'All machines, plant-wide'
                    : `${deviation.equipment.map(machineName).join(', ')} only`}
                </TableCell>
                <TableCell className={cell}>
                  <span className="flex flex-col">
                    <span>{deviation.reason ?? 'No reason given'}</span>
                    {deviation.addedBy !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        Added by {deviation.addedBy}
                        {deviation.addedAtMs !== undefined &&
                          `, ${plantTime(snapshot, deviation.addedAtMs)}`}
                      </span>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/** One block of a day column: its hours and its texts. */
interface DayBlock {
  /** Unique within the day: the deviation's id for overtime, the pattern's part otherwise. */
  readonly id: string;
  readonly kind: 'shift' | 'break' | 'overtime' | 'closed';
  readonly from: number;
  readonly to: number;
  readonly label: string;
  readonly sub?: string;
  /** A shift's order in the calendar version, which picks its color. */
  readonly order?: number;
}

/**
 * The blocks of one day from its view under ADR 0025's precedence (`calendarDay`): each shift that
 * starts on the day and its breaks, the part after midnight of the shifts of the day before, the
 * overtime that applies, the closure of the day, and with all machines the machines' own closures.
 */
function blocksOf(
  calendar: PlantCalendar,
  date: string,
  weekday: number,
  machine: string | undefined,
  machineName: (code: string) => string,
): {
  readonly blocks: readonly PlacedBlock[];
  readonly closed: PlantCalendarDeviation | undefined;
  readonly machineClosures: readonly PlantCalendarDeviation[];
} {
  const day = calendarDay(calendar, date, weekday, machine);
  const breakBlock = (each: { readonly start: string; readonly end: string }, id: string) => ({
    id,
    kind: 'break' as const,
    from: hoursOf(each.start),
    to: hoursOf(each.end) > hoursOf(each.start) ? hoursOf(each.end) : 24,
    label: `Break ${each.start} to ${each.end}`,
  });
  const blocks: DayBlock[] = [];
  const weekdayBefore = weekday === 1 ? 7 : weekday - 1;
  calendar.shifts.forEach((shift, order) => {
    const start = hoursOf(shift.start);
    const end = hoursOf(shift.end);
    // A shift belongs to the date it starts and may cross midnight (ADR 0025 rule 1): its part
    // after midnight, with the breaks in it, sits at the top of the next day.
    const crosses = end <= start;
    const afterMidnight = (clock: string) => crosses && hoursOf(clock) < start;
    // A break that starts before midnight and ends after it, 23:45 to 00:15, shows on both dates.
    const acrossMidnight = (one: { readonly start: string; readonly end: string }) =>
      crosses &&
      !afterMidnight(one.start) &&
      hoursOf(one.end) > 0 &&
      hoursOf(one.end) < hoursOf(one.start);
    // A closure of this day covers the part after midnight; one of the day before does not.
    if (crosses && shift.weekdays.includes(weekdayBefore) && day.closed === undefined) {
      blocks.push({
        id: `shift-${order}-before`,
        kind: 'shift',
        order,
        from: 0,
        to: end,
        label: shiftLabel(shift),
        sub: `From ${weekdayName(weekdayBefore).slice(0, 3)}`,
      });
      for (const each of shift.breaks.filter((one) => afterMidnight(one.start))) {
        blocks.push(breakBlock(each, `shift-${order}-break-before-${each.start}`));
      }
      for (const each of shift.breaks.filter(acrossMidnight)) {
        blocks.push({
          ...breakBlock(each, `shift-${order}-break-before-${each.start}`),
          from: 0,
          to: hoursOf(each.end),
        });
      }
    }
    if (day.closed === undefined && shift.weekdays.includes(weekday)) {
      blocks.push({
        id: `shift-${order}`,
        kind: 'shift',
        order,
        from: start,
        to: crosses ? 24 : end,
        label: shiftLabel(shift),
        sub: hoursText(shift.workingSeconds),
      });
      for (const each of shift.breaks.filter((one) => !afterMidnight(one.start))) {
        blocks.push(breakBlock(each, `shift-${order}-break-${each.start}`));
      }
    }
  });
  for (const deviation of day.overtime) {
    // The part of the deviation on this day: from midnight when it began the day before, to
    // midnight when it ends on a later day.
    const from = dateOf(deviation.startsLocal) < date ? 0 : hoursOf(clockOf(deviation.startsLocal));
    const to = dateOf(deviation.endsLocal) > date ? 24 : hoursOf(clockOf(deviation.endsLocal));
    blocks.push({
      id: deviation.id,
      kind: 'overtime',
      from,
      to,
      label: `Overtime ${clockOf(deviation.startsLocal)} to ${clockOf(deviation.endsLocal)}`,
      sub: `${
        deviation.equipment === undefined
          ? 'All machines'
          : `${deviation.equipment.map(machineName).join(', ')} only`
      }, ${hoursText((to - from) * 3600)}`,
    });
  }
  return { blocks: placed(blocks), closed: day.closed, machineClosures: day.machineClosures };
}

/** A block with its place across the day: lane of lanes, one lane for the full width. */
interface PlacedBlock extends DayBlock {
  readonly lane: number;
  readonly lanes: number;
}

/**
 * The day's blocks with overtime that overlaps in time side by side: overtime blocks that overlap
 * form a group, each takes the first free lane of its group, and the group's width is split by
 * its lanes. Plant overtime and a machine's overtime at the same time stay both in view.
 */
function placed(blocks: readonly DayBlock[]): PlacedBlock[] {
  const lanes = new Map<string, { readonly lane: number; readonly group: number }>();
  const groupLanes: number[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;
  let laneEnds: number[] = [];
  const overtime = blocks
    .filter((block) => block.kind === 'overtime')
    .toSorted((a, b) => a.from - b.from);
  for (const block of overtime) {
    if (block.from >= groupEnd) {
      groupLanes.push(0);
      laneEnds = [];
    }
    const free = laneEnds.findIndex((laneEnd) => laneEnd <= block.from);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = block.to;
    const group = groupLanes.length - 1;
    groupLanes[group] = Math.max(groupLanes[group] ?? 0, laneEnds.length);
    groupEnd = Math.max(groupEnd, block.to);
    lanes.set(block.id, { lane, group });
  }
  return blocks.map((block) => {
    const at = lanes.get(block.id);
    return at === undefined
      ? { ...block, lane: 0, lanes: 1 }
      : { ...block, lane: at.lane, lanes: groupLanes[at.group] ?? 1 };
  });
}

/** "on Mill 1" or "on CNC 1, CNC 2": the machines a deviation applies to, or nothing if plant-wide. */
function onMachines(
  deviation: PlantCalendarDeviation,
  machineName: (code: string) => string,
): string {
  return deviation.equipment === undefined
    ? ''
    : ` on ${deviation.equipment.map(machineName).join(', ')}`;
}

/** ", plant holiday": a deviation's reason inside a sentence, or nothing. */
function reasonText(deviation: PlantCalendarDeviation): string {
  return deviation.reason === undefined
    ? ''
    : `, ${deviation.reason.charAt(0).toLowerCase()}${deviation.reason.slice(1)}`;
}

const blockClass: Readonly<Record<DayBlock['kind'], string>> = {
  // A shift's edge and fill come from its order (shiftColor).
  shift: 'text-foreground',
  break: 'border-dashed border-input bg-muted text-muted-foreground',
  overtime: 'border-success bg-success-subtle text-foreground',
  closed: 'border-destructive bg-destructive-subtle text-destructive',
};

/** "CNC 1, CNC 2 and Mill 1": the names as a list in a sentence. */
function listText(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'no machine';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "two" for 2, else the digits. */
function countWord(count: number, sentenceStart = false): string {
  const word = ['no', 'one', 'two', 'three'][count] ?? String(count);
  return sentenceStart ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word;
}

/** "Monday to Friday", "Monday, Wednesday and Friday" or "Monday": the days a shift starts on. */
function daysSentence(weekdays: readonly number[]): string {
  const days = [...weekdays].sort((a, b) => a - b);
  const first = days[0];
  const last = days[days.length - 1];
  // A span only for consecutive days, as shiftText writes it.
  const consecutive = first !== undefined && last !== undefined && last - first + 1 === days.length;
  if (first === undefined || last === undefined) return 'no working days';
  if (first === last) return weekdayName(first);
  return consecutive
    ? `${weekdayName(first)} to ${weekdayName(last)}`
    : listText(days.map(weekdayName));
}

/**
 * The pattern in a sentence: "Monday to Friday 06:00 to 15:00 with two breaks" for one shift, and
 * the shifts grouped by their days for several: "Monday to Friday Early 06:00 to 14:00 and Late
 * 14:00 to 22:00, Monday to Thursday Night 22:00 to 06:00, each shift with two breaks".
 */
function patternDescription(calendar: PlantCalendar): string {
  const breaks = (count: number) => `${countWord(count)} break${count === 1 ? '' : 's'}`;
  const [only, ...others] = calendar.shifts;
  if (only === undefined) return 'no working days';
  if (others.length === 0) {
    return only.weekdays.length === 0
      ? 'no working days'
      : `${daysSentence(only.weekdays)} ${only.start} to ${only.end} with ${breaks(only.breaks.length)}`;
  }
  const groups = new Map<string, PlantShift[]>();
  for (const shift of calendar.shifts) {
    const key = daysSentence(shift.weekdays);
    groups.set(key, [...(groups.get(key) ?? []), shift]);
  }
  const parts = [...groups].map(([days, shifts]) => `${days} ${listText(shifts.map(shiftLabel))}`);
  const counts = new Set(calendar.shifts.map((shift) => shift.breaks.length));
  const [count] = counts;
  if (counts.size === 1 && count !== undefined) {
    return `${parts.join(', ')}, each shift with ${breaks(count)}`;
  }
  // The shifts' breaks differ, so each shift says its own.
  return [...groups]
    .map(
      ([days, shifts]) =>
        `${days} ${listText(shifts.map((shift) => `${shiftLabel(shift)} with ${breaks(shift.breaks.length)}`))}`,
    )
    .join(', ');
}

/**
 * The accessible description of the week (CA1): the pattern, then each deviation in view:
 * "Week 45: Monday to Friday 06:00 to 15:00 with two breaks, Saturday 06:00 to 10:00 overtime on
 * Mill 1". A page reader gets the week in one sentence; the grid itself is a picture.
 */
function weekDescription(
  calendar: PlantCalendar,
  week: PlantWeek,
  machine: string | undefined,
  machineName: (code: string) => string,
): string {
  const parts = [patternDescription(calendar)];
  daysOf(week).forEach((date, index) => {
    const weekday = index + 1;
    const day = calendarDay(calendar, date, weekday, machine);
    const dayName = `${weekdayName(weekday)} ${formatPlantDay(date).slice(4)}`;
    if (day.closed !== undefined) {
      parts.push(
        `${dayName} closed${onMachines(day.closed, machineName)}${reasonText(day.closed)}`,
      );
    }
    for (const closure of day.machineClosures) {
      parts.push(`${dayName} closed${onMachines(closure, machineName)}${reasonText(closure)}`);
    }
    for (const deviation of day.overtime) {
      parts.push(
        `${weekdayName(weekday)} ${clockOf(deviation.startsLocal)} to ${clockOf(deviation.endsLocal)} overtime${onMachines(deviation, machineName)}`,
      );
    }
  });
  return `Week ${week.week}: ${parts.join(', ')}`;
}

/** The Week section (CA1): the machine choice, the week controls and the hour grid. */
function WeekSection({
  snapshot,
  calendar,
  week,
  onWeekChange,
}: {
  readonly snapshot: PlantSettingsSnapshot;
  readonly calendar: PlantCalendar;
  readonly week: PlantWeek;
  readonly onWeekChange: (monday: string) => void;
}) {
  const machineName = machineNamer(snapshot);
  const [machine, setMachine] = useState<string | undefined>(undefined);
  const days = daysOf(week);
  const perDay = days.map((date, index) =>
    blocksOf(calendar, date, index + 1, machine, machineName),
  );
  const hours = perDay.flatMap(({ blocks }) => blocks.flatMap((block) => [block.from, block.to]));
  const starts = calendar.shifts.map((shift) => hoursOf(shift.start));
  const ends = calendar.shifts.map((shift) => hoursOf(shift.end));
  // A week that draws no block takes its hours from every shift start and end, so a night shift
  // still spans its hours; a calendar without shifts draws a day, 06:00 to 18:00.
  const bounds = hours.length > 0 ? hours : [...starts, ...ends];
  const startHour =
    bounds.length === 0 ? 6 : Math.max(0, Math.floor(Math.min(...starts, ...bounds)) - 1);
  const endHour =
    bounds.length === 0 ? 18 : Math.min(24, Math.ceil(Math.max(...ends, ...bounds)) + 1);
  const y = (hour: number) => (hour - startHour) * hourPx;
  const height = y(endHour);
  return (
    <Section title="Week" className="lg:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <fieldset aria-label="Machine" className="flex rounded-lg bg-muted p-0.5">
          {[undefined, ...calendar.machines].map((code) => (
            <Button
              key={code ?? 'all'}
              variant="ghost"
              aria-pressed={code === machine}
              onClick={() => setMachine(code)}
              className={cn(
                'h-7 px-2.5',
                code === machine && 'bg-card shadow-[inset_0_-2px_0_var(--foreground)]',
              )}
            >
              {code === undefined ? 'All machines' : machineName(code)}
            </Button>
          ))}
        </fieldset>
        <span className="grow" />
        <IconButton
          label="Show the earlier week"
          variant="outline"
          size="icon-sm"
          onClick={() => onWeekChange(shiftedWeek(week.monday, 'earlier'))}
        >
          <ChevronLeft />
        </IconButton>
        <span className="font-mono text-data font-medium">{week.label}</span>
        <IconButton
          label="Show the later week"
          variant="outline"
          size="icon-sm"
          onClick={() => onWeekChange(shiftedWeek(week.monday, 'later'))}
        >
          <ChevronRight />
        </IconButton>
      </div>
      {/* The legend names each shift before the view, so a shift's color is never the only cue. */}
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {/* Keyed by order: a shift's order is its identity, and names may repeat. */}
        {calendar.shifts.map((shift, order) => (
          <li key={order} className="inline-flex items-center gap-1.5">
            <ShiftKey order={order} />
            <ShiftName shift={shift} />
          </li>
        ))}
        {(
          [
            ['Break', 'border-dashed border-input bg-muted'],
            ['Overtime deviation', 'border-success bg-success-subtle'],
            [
              'Non-working deviation',
              'border-destructive bg-[repeating-linear-gradient(135deg,var(--destructive-subtle)_0_3px,transparent_3px_6px)]',
            ],
            ['Closed time', 'border-border bg-card'],
          ] as const
        ).map(([label, key]) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('inline-block size-3.5 shrink-0 rounded-[3px] border', key)}
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      {/* Narrower than the week, the view scrolls sideways in its own region (design #770, CS3). */}
      <section
        aria-label="Week view"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region takes keyboard focus so it can scroll.
        tabIndex={0}
        className="overflow-x-auto rounded-md border border-border"
      >
        <div
          role="img"
          aria-label={weekDescription(calendar, week, machine, machineName)}
          className="grid min-w-[52rem] grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] overflow-hidden bg-card"
        >
          <div
            className="relative border-r border-border"
            style={{ height: height + 40, marginTop: 0 }}
          >
            {Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index).map(
              (hour) => (
                <span
                  key={hour}
                  className="absolute right-1.5 -translate-y-1/2 font-mono text-tick text-muted-foreground"
                  style={{ top: 40 + y(hour) }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ),
            )}
          </div>
          {days.map((date, index) => {
            const { blocks, closed, machineClosures } = perDay[index] ?? {
              blocks: [],
              closed: undefined,
              machineClosures: [],
            };
            const weekend = !calendar.shifts.some((shift) => shift.weekdays.includes(index + 1));
            return (
              <div key={date} className="flex flex-col border-l border-border first:border-l-0">
                <div
                  className={cn(
                    'flex h-10 flex-col border-b border-border bg-muted px-2 py-1 text-xs leading-4 font-medium',
                    weekend && 'text-muted-foreground',
                  )}
                >
                  <span>{weekdayName(index + 1).slice(0, 3)}</span>
                  <span className="text-muted-foreground">{formatPlantDay(date).slice(4)}</span>
                </div>
                <div
                  className={cn(
                    'relative',
                    closed !== undefined &&
                      'bg-[repeating-linear-gradient(135deg,var(--destructive-subtle)_0_6px,transparent_6px_12px)]',
                  )}
                  style={{
                    height,
                    backgroundImage:
                      closed === undefined
                        ? `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${hourPx}px)`
                        : undefined,
                  }}
                >
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className={cn(
                        'absolute overflow-hidden rounded-sm border px-1.5 text-xs leading-4',
                        block.lanes === 1 && 'inset-x-1',
                        block.kind === 'break' ? 'py-0 text-tick' : 'py-1',
                        blockClass[block.kind],
                        block.kind === 'shift' && shiftColor(block.order ?? 0),
                      )}
                      style={{
                        top: y(block.from),
                        height: y(block.to) - y(block.from),
                        // Lane of lanes across the day's width inside its 0.25rem inset.
                        ...(block.lanes > 1 && {
                          left: `calc(0.25rem + (100% - 0.5rem) * ${block.lane / block.lanes})`,
                          width: `calc((100% - 0.5rem) / ${block.lanes})`,
                        }),
                      }}
                    >
                      <span className={cn('block', block.kind !== 'break' && 'font-semibold')}>
                        {block.label}
                      </span>
                      {block.sub !== undefined && (
                        <span className="text-muted-foreground">{block.sub}</span>
                      )}
                    </div>
                  ))}
                  {/* The day's closures stack in one column after the blocks, so none covers
                    another and a stack that reaches into the shift stays on top. */}
                  {(closed !== undefined || machineClosures.length > 0) && (
                    <div className="absolute inset-x-1 top-1 flex flex-col gap-0.5">
                      {closed !== undefined && (
                        <div
                          className={cn(
                            'rounded-sm border px-1.5 py-1 text-xs leading-4',
                            blockClass.closed,
                          )}
                        >
                          <span className="block font-semibold">Closed</span>
                          <span>{closed.reason ?? 'Non-working'}</span>
                        </div>
                      )}
                      {/* With all machines, a machine's own closed day closes only that machine. */}
                      {machineClosures.map((closure) => (
                        <div
                          key={closure.id}
                          className={cn(
                            'rounded-sm border border-dashed px-1.5 py-0.5 text-tick',
                            blockClass.closed,
                          )}
                        >
                          Closed{onMachines(closure, machineName)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Section>
  );
}

/**
 * A calendar's page in plant settings (ADR 0025; design #688, CA1 and CA2): the shift pattern with
 * the working time per week, the deviations with their reasons and who added them, and the week
 * view of the shift, its breaks and the deviations of one week, by machine or for all. The week
 * lives in the URL; the machine choice stays local. Edit, New version and New deviation wait for
 * the equipment API.
 */
export function CalendarScreen() {
  const { plant } = useShell();
  const { calendarId = '' } = useParams({ strict: false });
  const search = calendarPageSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const { snapshot, error, retry } = usePlantSettings(search.preview);
  const calendar = snapshot?.calendars.find((each) => each.name === calendarId);
  const back = coreLinks.calendars({ plant }).href;
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof PlantSettingsForbidden) {
    state = plantSettingsForbiddenState('calendars');
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the calendar', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (calendar === undefined) {
    state = {
      status: 'empty',
      title: 'This calendar does not exist or you cannot see it',
      description:
        'The link may be out of date, or the calendar belongs to a plant you have no role in.',
      action: (
        <Link to={back} className={buttonVariants({ variant: 'outline' })}>
          Back to Calendars
        </Link>
      ),
    };
  }
  const loaded = snapshot !== undefined && calendar !== undefined;
  const defaultWeek =
    snapshot === undefined ? undefined : weekOf(snapshot.nowMs, snapshot.plant.timeZone);
  const week =
    snapshot === undefined
      ? undefined
      : search.week === undefined
        ? defaultWeek
        : weekOf(search.week, snapshot.plant.timeZone);
  return (
    <PageFrame
      title={calendar === undefined ? 'Calendar' : `Calendar ${calendar.name}`}
      crumbs={[{ label: 'Calendars', href: back }]}
      meta={
        loaded ? (
          <span className="text-sm text-muted-foreground">
            {calendar.plantDefault ? 'Plant calendar' : 'Calendar'} of the plant, used by{' '}
            {listText(calendar.machines.map(machineNamer(snapshot)))}. Times are plant time,{' '}
            {snapshot.plant.timeZone}.
          </span>
        ) : undefined
      }
      actions={
        loaded ? (
          <Button variant="outline" disabled>
            <Pencil aria-hidden />
            Edit
          </Button>
        ) : undefined
      }
      state={state}
    >
      {loaded && week !== undefined && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p>{plantSettingsActionReason}</p>
            {snapshot.fixture !== undefined && <p>Showing fixture {snapshot.fixture}.</p>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <PatternSection calendar={calendar} />
            <DeviationsSection snapshot={snapshot} calendar={calendar} />
            <WeekSection
              snapshot={snapshot}
              calendar={calendar}
              week={week}
              onWeekChange={(monday) =>
                navigate({
                  to: '.',
                  search: monday === defaultWeek?.monday ? {} : { week: monday },
                  replace: true,
                })
              }
            />
          </div>
        </>
      )}
    </PageFrame>
  );
}
