// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { RangeControls } from '../../components/range-controls/index.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import {
  type JobOrdersSearch,
  jobOrdersSearch,
  sortedBy,
  sortOf,
  withLateOnly,
} from '../../job-orders-search.ts';
import { phase1Reason } from '../../mock-reasons.ts';
import { plantDateOf, rangeLabel, rangeOf, shiftedFrom } from '../../timeline/time-scale.ts';
import { jobOrderTableRows, sortedJobOrderRows } from './job-orders-rows.ts';
import { JobOrdersTable, jobOrdersColumnChoices, jobOrdersColumns } from './job-orders-table.tsx';

/** The table opens at Week, as the Gantt does (D5). */
const defaultZoom = 'week';

/** The id of the Late only checkbox, which its label names. */
const lateOnlyId = 'job-orders-late-only';

/** "Sorted by machine, then start." for the default sort, else the column and its direction. */
function sortText(sort: ReturnType<typeof sortOf>): string {
  if (sort.id === 'machine' && !sort.desc) return 'Sorted by machine, then start.';
  const header = jobOrdersColumns.find((column) => column.id === sort.id)?.header ?? sort.id;
  return `Sorted by ${header.toLowerCase()}, ${sort.desc ? 'descending' : 'ascending'}.`;
}

/**
 * The job orders page (plan 07, Job order table view; plan 18; design #660, T1 and T2): the main
 * screen-reader path of the timeline. The range controls of the Gantt, Late only, Columns and
 * Table options above a semantic table of the job orders in the range, each with its machine,
 * span, quantity, status, soft lock holder, the order's deadline, planned end and late-by, with the
 * late facts under a late row. zoom, from, late and sort live in the URL, so a link from the board
 * or the Gantt carries the range (Krister, 2026-10-17); the columns stay local. Move is drawn but
 * disabled while the page reads the fixture G1.
 */
export function JobOrdersScreen() {
  const { plant } = useShell();
  const search = jobOrdersSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const setSearch = (next: JobOrdersSearch) =>
    navigate({ to: '.', search: next as Record<string, unknown>, replace: true });
  const source = useGanttSource();
  const [snapshot, setSnapshot] = useState<GanttSnapshot | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const zoom = search.zoom ?? defaultZoom;
  const timeZone = snapshot?.plant.timeZone ?? 'UTC';
  const productionDayStart = snapshot?.plant.productionDayStart ?? '06:00';
  // The range starts at the date in the URL, else at the snapshot's now, else at today.
  const from =
    search.from ??
    (snapshot === undefined
      ? plantDateOf(Date.now(), timeZone)
      : plantDateOf(snapshot.nowMs, timeZone));
  const range = useMemo(
    () => rangeOf(from, zoom, timeZone, productionDayStart),
    [from, zoom, timeZone, productionDayStart],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadError(undefined);
    source
      .load({
        from: new Date(range.fromMs).toISOString(),
        to: new Date(range.toMs).toISOString(),
        filter: { lateOnly: search.late === 1 },
      })
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error ?? new Error('The job orders could not be loaded'));
      });
    return () => {
      cancelled = true;
    };
  }, [source, range.fromMs, range.toMs, search.late, attempt]);

  const sort = sortOf(search);
  const lateOnly = search.late === 1;
  const rows = useMemo(
    () =>
      snapshot === undefined
        ? []
        : sortedJobOrderRows(jobOrderTableRows(snapshot, range, lateOnly), sort),
    [snapshot, range, lateOnly, sort],
  );
  const label = rangeLabel(range, zoom, timeZone);
  const lateRows = rows.filter((row) => row.analysis?.late).length;

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && loadError !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the job orders',
      error: loadError,
      onRetry: () => {
        setAttempt((count) => count + 1);
        return Promise.resolve();
      },
    };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No job orders in this range',
      description: lateOnly
        ? 'No order with a job order in this range is late. Turn Late only off, or move the range.'
        : 'Move the range with Earlier, Later or Go to date to find job orders.',
      action: (
        <Button
          variant="outline"
          onClick={() => void setSearch({ ...search, from: shiftedFrom(from, zoom, 'later') })}
        >
          Show the next range
        </Button>
      ),
    };
  }
  const statusText = [
    `${rows.length} job orders in ${label}`,
    lateRows > 0 ? `${lateRows} late` : undefined,
    lateOnly ? 'late only' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
  const rangeSearch = { zoom, from };
  return (
    <PageFrame
      title="Job orders"
      state={state}
      toolbar={
        <div className="flex flex-col gap-2">
          <div role="toolbar" aria-label="Job table" className="flex flex-wrap items-center gap-2">
            <RangeControls
              presetLabel="Range"
              zoom={zoom}
              onZoomChange={(next) => void setSearch({ ...search, zoom: next })}
              from={from}
              onFromChange={(next) => void setSearch({ ...search, from: next })}
              onEarlier={() =>
                void setSearch({ ...search, from: shiftedFrom(from, zoom, 'earlier') })
              }
              onNow={() =>
                void setSearch({
                  ...search,
                  from: plantDateOf(snapshot?.nowMs ?? Date.now(), timeZone),
                })
              }
              onLater={() => void setSearch({ ...search, from: shiftedFrom(from, zoom, 'later') })}
              rangeLabel={label}
            />
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={lateOnlyId}
                checked={lateOnly}
                onCheckedChange={(checked) => void setSearch(withLateOnly(search, checked))}
              />
              <FieldLabel htmlFor={lateOnlyId}>Late only</FieldLabel>
            </Field>
            <span className="grow" />
            <ColumnsMenu
              columns={jobOrdersColumnChoices}
              hidden={hiddenColumns}
              onChange={setHiddenColumns}
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon-sm" aria-label="Table options" />}
              >
                <Ellipsis aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem
                  render={<Link to={planningLinks.gantt({ plant }, rangeSearch).href} />}
                >
                  Open the Gantt at this range
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link to={planningLinks.board({ plant }, rangeSearch).href} />}
                >
                  Open the planning board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* The status line stays in every state, the empty state included, as the toolbar does. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <p role="status">
              {statusText}. {sortText(sort)}
            </p>
            {snapshot?.fixture !== undefined && <p>Showing fixture {snapshot.fixture}.</p>}
          </div>
        </div>
      }
    >
      <JobOrdersTable
        label={`Job orders, ${label}`}
        rows={rows}
        snapshot={snapshot}
        zoom={zoom}
        from={from}
        sort={sort}
        onSortChange={(next) => void setSearch(sortedBy(search, next))}
        hiddenColumns={hiddenColumns}
        expanded={expanded}
        onToggleFacts={(id) =>
          setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        loading={snapshot === undefined}
      />
      <p className="text-xs text-muted-foreground">{phase1Reason}</p>
    </PageFrame>
  );
}
