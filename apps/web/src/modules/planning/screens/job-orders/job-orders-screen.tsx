// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChoiceMenu } from '../../../../ui/components/choice-menu/index.ts';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import type { DataTableGroup } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import {
  type ListFilterField,
  OrderListToolbar,
} from '../../components/order-list-toolbar/index.ts';
import { applyDraft, draftRowIds } from '../../gantt-draft.ts';
import {
  type JobOrderGroupKey,
  type JobOrdersSearch,
  jobOrdersSearch,
  notPlaced,
  sortedBy,
  sortOf,
} from '../../job-orders-search.ts';
import { phase1Reason } from '../../mock-reasons.ts';
import {
  filteredBy,
  groupedBy,
  searchedFor,
  unfiltered,
  urlSearchOf,
  withLateOnly,
} from '../../order-list-search.ts';
import { usePlanningDraft } from '../../planning-draft.tsx';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { statusLabel } from '../gantt/gantt-rows.ts';
import {
  groupedJobOrderRows,
  type JobOrderFilterKey,
  type JobOrderTableRow,
  jobOrderCountText,
  jobOrderFacets,
  jobOrderRowMatches,
  jobOrderTableRows,
  narrowsRows,
  notPlacedLabel,
  sortedJobOrderRows,
} from './job-orders-rows.ts';
import { JobOrdersTable, jobOrdersColumnChoices, jobOrdersColumns } from './job-orders-table.tsx';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'job-orders-search';

/** The choices of Group by, by their URL values. */
const groupChoices: readonly {
  readonly value: JobOrderGroupKey | undefined;
  readonly label: string;
}[] = [
  { value: undefined, label: 'No grouping' },
  { value: 'equipment', label: 'Machine' },
  { value: 'startDay', label: 'Start day' },
];

/** "Sorted by start." for the default sort, else the column and its direction. */
function sortText(sort: ReturnType<typeof sortOf>): string {
  if (sort.id === 'start' && !sort.desc) return 'Sorted by start.';
  const header = jobOrdersColumns.find((column) => column.id === sort.id)?.header ?? sort.id;
  return `Sorted by ${header.toLowerCase()}, ${sort.desc ? 'descending' : 'ascending'}.`;
}

/**
 * The job orders page (plan 07, Job order table view; ADR 0091): the main screen-reader path of
 * the plan, as a work list. Every open job order of the plant with its machine, span, quantity,
 * status, soft lock holder, the order's deadline, planned end and late-by, with the late facts
 * under a late row; the search, Late only, the Machine, Status and Article filters with their
 * counts, Group by and Columns above it, and no time range. Search, Late only, the filters, the
 * grouping and the sort live in the URL (ADR 0062); the columns and the collapsed groups stay
 * local. Move is drawn but disabled while the page reads the fixture G1.
 */
export function JobOrdersScreen() {
  const { plant } = useShell();
  const search = useSearch({ strict: false });
  const view = useMemo(() => jobOrdersSearch(search), [search]);
  const navigate = useNavigate();
  const show = (next: JobOrdersSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = usePlanningSnapshot();
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  // The rows read the plan with the planner's draft applied, the draft the board and the Gantt
  // write (plan 07, Drafts).
  const [draft] = usePlanningDraft();
  const applied = useMemo(
    () => (snapshot === undefined ? undefined : applyDraft(snapshot, draft)),
    [snapshot, draft],
  );
  const allRows = useMemo(
    () => (applied === undefined ? [] : jobOrderTableRows(applied, draftRowIds(draft))),
    [applied, draft],
  );
  const sort = useMemo(() => sortOf(view), [view]);
  const rows = useMemo(
    () =>
      sortedJobOrderRows(
        allRows.filter((row) => jobOrderRowMatches(row, view)),
        sort,
      ),
    [allRows, view, sort],
  );
  const timeZone = applied?.plant.timeZone ?? 'UTC';
  const groups = useMemo(
    () => (view.group === undefined ? undefined : groupedJobOrderRows(rows, view.group, timeZone)),
    [rows, view.group, timeZone],
  );

  const machineName = (code: string) =>
    code === notPlaced
      ? notPlacedLabel
      : (applied?.equipment.find((machine) => machine.code === code)?.name ?? code);
  const labelOf = (key: JobOrderFilterKey) =>
    key === 'equipment' ? machineName : key === 'status' ? statusLabel : (value: string) => value;
  const fields: ListFilterField[] = (
    [
      ['equipment', 'Machine', 'Show job orders on these machines', 'Remove the machine filter'],
      ['status', 'Status', 'Show job orders with these statuses', 'Remove the status filter'],
      ['article', 'Article', 'Show job orders of these articles', 'Remove the article filter'],
    ] as const
  ).map(([key, label, heading, remove]) => ({
    key,
    label,
    heading,
    remove,
    values: jobOrderFacets(allRows, view, key, labelOf(key)),
    picked: view[key] ?? [],
  }));

  const lateCount = rows.filter((row) => row.analysis?.late).length;
  const notPlacedCount = rows.filter((row) => !row.placed).length;
  const counts = [
    jobOrderCountText(rows.length),
    lateCount > 0 ? `${lateCount} late` : undefined,
    notPlacedCount > 0 ? `${notPlacedCount} not placed` : undefined,
    view.late === 1 ? 'late only' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
  const groupLabel = groupChoices.find((choice) => choice.value === view.group)?.label ?? '';
  // While nothing is loaded, the line says so rather than counting no rows.
  const statusLine =
    snapshot === undefined
      ? error === undefined
        ? 'Loading the job orders.'
        : 'Could not load the job orders.'
      : `${counts}. ${
          groups === undefined
            ? sortText(sort)
            : `${groups.length} group${groups.length === 1 ? '' : 's'} by ${groupLabel.toLowerCase()}, job orders ${sortText(sort).charAt(0).toLowerCase()}${sortText(sort).slice(1)}`
        }`;
  // A change of the rows after a user action is announced once through the app's helper; the
  // first rows are not.
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the job orders', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      title: 'No job orders yet',
      description:
        'Job orders come with the production orders, from the ERP or created here. They show here once an order has its operations.',
    };
  } else if (rows.length === 0 && !narrowsRows(view)) {
    state = {
      status: 'empty',
      title: 'No open job orders',
      description: 'Pick Finished under Status to see the finished job orders.',
    };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No job orders match these filters',
      description: 'Change or clear the filters to see job orders again.',
      action: (
        <Button
          variant="link"
          onClick={() => {
            show(withLateOnly(unfiltered(searchedFor(view, '')), false));
            document.getElementById(searchFieldId)?.focus();
          }}
        >
          Clear filters
        </Button>
      ),
    };
  }
  // A collapsed group is kept per grouping, so Not placed under Machine and under Start day are two.
  const tableGroups: DataTableGroup<JobOrderTableRow>[] | undefined = groups?.map((group) => {
    const key = `${view.group}:${group.id}`;
    return {
      id: group.id,
      label: group.label,
      count: jobOrderCountText(group.rows.length),
      rows: group.rows,
      expanded: !collapsed.has(key),
      onExpandedChange: (open) =>
        setCollapsed((current) => {
          const next = new Set(current);
          if (open) next.delete(key);
          else next.add(key);
          return next;
        }),
    };
  });
  return (
    <PageFrame
      title="Job orders"
      state={state}
      toolbar={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <div className="grow">
              <OrderListToolbar
                searchId={searchFieldId}
                searchLabel="Search job orders"
                q={view.q ?? ''}
                onSearch={(q) => show(searchedFor(view, q))}
                lateOnly={view.late === 1}
                onLateOnlyChange={(on) => show(withLateOnly(view, on))}
                fields={fields}
                onFilterChange={(key, values) => show(filteredBy(view, key, values))}
                onClearFilters={() => show(unfiltered(view))}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon-sm" aria-label="Table options" />}
              >
                <Ellipsis aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem render={<Link to={planningLinks.gantt({ plant }).href} />}>
                  Open the Gantt
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to={planningLinks.board({ plant }).href} />}>
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
        label="Job orders"
        rows={rows}
        groups={tableGroups}
        snapshot={applied}
        sort={sort}
        onSortChange={(next) => void show(sortedBy(view, next))}
        hiddenColumns={hiddenColumns}
        headerMenu={
          <>
            <ChoiceMenu
              compact
              label="Group by"
              choices={groupChoices}
              value={view.group}
              onChange={(group) => show(groupedBy(view, group))}
            />
            <ColumnsMenu
              compact
              columns={jobOrdersColumnChoices}
              hidden={hiddenColumns}
              onChange={setHiddenColumns}
            />
          </>
        }
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
