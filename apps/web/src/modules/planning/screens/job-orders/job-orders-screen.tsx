// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
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
import {
  plantDateOf,
  rangeLabel,
  rangeOf,
  shiftedFrom,
  type TimeRange,
} from '../../timeline/time-scale.ts';
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

/** A snapshot the page loaded, with the request it answers: its range and Late only. */
interface Loaded {
  readonly key: string;
  readonly range: TimeRange;
  readonly lateOnly: boolean;
  readonly snapshot: GanttSnapshot;
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
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  /** Settles the promise of Try again once the reload it started has settled. */
  const retryDone = useRef<(() => void) | undefined>(undefined);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const snapshot = loaded?.snapshot;

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

  const lateOnly = search.late === 1;
  // The request the page shows: a snapshot loaded for another key is the view before, kept dimmed
  // while this one loads (design ui-222, LI7), and the first load without a date in the URL asks
  // again once the snapshot's now names the week.
  const loadKey = `${range.fromMs}:${range.toMs}:${lateOnly}:${attempt}`;
  useEffect(() => {
    let cancelled = false;
    setLoadError(undefined);
    source
      .load({
        from: new Date(range.fromMs).toISOString(),
        to: new Date(range.toMs).toISOString(),
        filter: { lateOnly },
      })
      .then((answer) => {
        if (!cancelled) setLoaded({ key: loadKey, range, lateOnly, snapshot: answer });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error ?? new Error('The job orders could not be loaded'));
      })
      .finally(() => {
        if (cancelled) return;
        retryDone.current?.();
        retryDone.current = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [source, loadKey, range, lateOnly]);
  const stale = loaded !== undefined && loaded.key !== loadKey;

  const sort = sortOf(search);
  // The rows of the loaded request, so a range change shows the rows of the view before, dimmed,
  // until its own rows arrive, never the old snapshot cut to the new range.
  const rows = useMemo(
    () =>
      loaded === undefined
        ? []
        : sortedJobOrderRows(
            jobOrderTableRows(loaded.snapshot, loaded.range, loaded.lateOnly),
            sort,
          ),
    [loaded, sort],
  );
  const label = rangeLabel(range, zoom, timeZone);
  const lateRows = rows.filter((row) => row.analysis?.late).length;

  let state: PageState = { status: 'ready' };
  if (loadError !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the job orders',
      error: loadError,
      onRetry: () =>
        new Promise<void>((resolve) => {
          retryDone.current = resolve;
          setAttempt((count) => count + 1);
        }),
    };
  } else if (loaded === undefined) {
    state = { status: 'loading' };
  } else if (!stale && rows.length === 0) {
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
  const statusLine = `${statusText}. ${sortText(sort)}`;
  // A change of the rows after a user action is announced once through the app's helper; the
  // first rows, and the rows of the view before while the next loads, are not.
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (loaded === undefined || stale) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [loaded, stale, statusLine]);
  const rangeSearch = { zoom, from };
  return (
    <PageFrame
      title="Job orders"
      state={state}
      busy={stale}
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
            <p data-job-orders-status>{statusLine}</p>
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
        loading={loaded === undefined}
        stale={stale}
      />
      <p className="text-xs text-muted-foreground">{phase1Reason}</p>
    </PageFrame>
  );
}
