// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { PlantCalendar, PlantSettingsSnapshot } from '../../plant-settings-data.ts';
import {
  hoursText,
  machineNamer,
  shiftText,
  weeklyWorkingSeconds,
} from '../../plant-settings-facts.ts';
import { plantSettingsActionReason } from '../../plant-settings-reasons.ts';
import { usePlantSettings } from '../../plant-settings-source-context.ts';

function columnsOf(
  snapshot: PlantSettingsSnapshot,
  plant: string,
): readonly DataTableColumn<PlantCalendar>[] {
  const machineName = machineNamer(snapshot);
  return [
    {
      id: 'name',
      header: 'Name',
      cell: (calendar) => (
        <Link
          to={coreLinks.calendars.calendar({ plant, calendarId: calendar.name }).href}
          className="font-mono text-link underline underline-offset-2 hover:no-underline"
        >
          {calendar.name}
        </Link>
      ),
    },
    {
      id: 'machines',
      header: 'Machines',
      cell: (calendar) => calendar.machines.map(machineName).join(', '),
    },
    {
      id: 'shift',
      header: 'Shift',
      cell: (calendar) => <span className="font-mono">{shiftText(calendar)}</span>,
    },
    {
      id: 'week',
      header: 'Working time per week',
      numeric: true,
      cell: (calendar) => (
        <span className="font-mono">{hoursText(weeklyWorkingSeconds(calendar))}</span>
      ),
    },
  ];
}

/**
 * The plant's working-time calendars in plant settings (ADR 0025): one row per calendar with its
 * machines, shift and working time per week, each leading to its page. The design round drew the
 * calendar page alone (#688, CA1); this list is the entry's landing. New calendar waits for the
 * equipment API.
 */
export function CalendarsScreen() {
  const { plant } = useShell();
  const { snapshot, error, retry } = usePlantSettings(undefined);
  const columns = useMemo(
    () => (snapshot === undefined ? [] : columnsOf(snapshot, plant)),
    [snapshot, plant],
  );
  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load calendars', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (snapshot.calendars.length === 0) {
    state = {
      status: 'empty',
      title: 'No calendars yet',
      description: 'A calendar gives its machines their working time. Create the first one.',
    };
  }
  return (
    <PageFrame
      title="Calendars"
      actions={
        <Button disabled>
          <Plus aria-hidden />
          New calendar
        </Button>
      }
      toolbar={
        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          {snapshot?.fixture !== undefined && <span>Showing fixture {snapshot.fixture}.</span>}
          <span>{plantSettingsActionReason}</span>
        </p>
      }
      state={state}
    >
      <DataTable
        label="Calendars"
        columns={columns}
        rows={snapshot?.calendars ?? []}
        getRowId={(calendar) => calendar.name}
        loading={snapshot === undefined}
      />
    </PageFrame>
  );
}
