// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Drill, ShieldOff } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { RangeControls } from '../../components/range-controls/index.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import {
  type BoardSearch,
  boardSearch,
  withFrom,
  withOrder,
  withZoom,
} from '../../gantt-search.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import { plantTime } from '../../order-facts.ts';
import { PlanningForbidden } from '../../planning-preview.ts';
import { closedWindows } from '../../timeline/availability-shading.ts';
import {
  createTimeScale,
  naturalWidthPx,
  plantDateOf,
  rangeLabel,
  rangeOf,
  shiftedFrom,
} from '../../timeline/time-scale.ts';
import { useMeasuredWidth, useViewportFill } from '../../use-grid-size.ts';
import { type GanttViewContext, GanttViewProvider } from '../gantt/gantt-context.ts';
import { type BoardCellItem, cellsOf } from './board-cells.ts';
import { BoardGrid, focusKeys } from './board-grid.tsx';
import { type BoardLine, boardEntry, boardFocusAfter } from './board-navigation.ts';
import { type BoardModel, boardModelOf } from './board-rows.ts';
import { BoardSkeleton } from './board-skeleton.tsx';

/** The board opens at Week, as the Gantt and the job order table do (D5; D3 open question 1). */
const defaultZoom = 'week';

/**
 * The machine column: 200 px, never more than 40 percent of the grid (plan 07). D3 proposes fitting
 * the longest name between 168 and 272 px.
 */
const machineColumnPx = 200;
const machineColumnShare = 0.4;

/** The lines of the grid that the arrow keys move over, in the grid's order. */
function linesOf(
  model: BoardModel,
  cells: ReadonlyMap<string, readonly BoardCellItem[]>,
  collapsed: ReadonlySet<string>,
): BoardLine[] {
  const lines: BoardLine[] = [
    {
      kind: 'notPlaced',
      cells:
        model.notPlaced.length === 0
          ? [{ key: focusKeys.notPlacedEmpty }]
          : model.notPlaced.map((row) => ({ key: focusKeys.block(row.jobOrder.id) })),
    },
  ];
  for (const group of model.groups) {
    lines.push({ kind: 'group', header: focusKeys.group(group.code), cells: [] });
    if (collapsed.has(group.code)) continue;
    for (const machine of group.machines) {
      const code = machine.equipment.code;
      const row = cells.get(code) ?? [];
      lines.push({
        kind: 'machine',
        header: focusKeys.header(code),
        cells:
          row.length === 0
            ? [{ key: focusKeys.empty(code) }]
            : row.map((cell) => {
                if (cell.kind === 'cluster') {
                  return { key: cell.key, fromMs: cell.fromMs, toMs: cell.toMs };
                }
                const placement = cell.row.jobOrder.placement;
                return {
                  key: focusKeys.block(cell.row.jobOrder.id),
                  ...(placement !== undefined && {
                    fromMs: placement.setupStartMs,
                    toMs: placement.endMs,
                  }),
                };
              }),
      });
    }
  }
  return lines;
}

/**
 * The planning board (plan 07, Planning board in release 1; design D3): the machines of the plant
 * grouped by equipment group on a time axis in plant time, each machine's job orders as blocks in
 * the order color, the pinned Not placed row and the range controls the timeline pages share. The
 * board, the order Gantt and the job order table are pages of their own (Krister, 2026-10-17), so
 * the page has no view control. zoom and from live in the URL; collapsed groups stay local. The
 * page reads one data source and never knows which; phase 1 reads the fixture G1 and says so.
 */
export function BoardScreen() {
  const source = useGanttSource();
  const { plant } = useShell();
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => boardSearch(rawSearch), [rawSearch]);
  const navigate = useNavigate();
  // The range replaces the history entry; a change of the selected order pushes one, so Back
  // returns to the order before (design D3, URL state).
  const setSearch = useCallback(
    (next: BoardSearch, history: 'replace' | 'push' = 'replace') =>
      navigate({
        to: '.',
        search: next as Record<string, unknown>,
        replace: history === 'replace',
      }),
    [navigate],
  );
  const [snapshot, setSnapshot] = useState<GanttSnapshot | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | undefined>(undefined);
  const [width, measureRef] = useMeasuredWidth();
  const zoom = search.zoom ?? defaultZoom;
  const [fillHeight, fillRef] = useViewportFill(`${zoom}|${search.from ?? ''}`);

  const timeZone = snapshot?.plant.timeZone ?? 'UTC';
  const productionDayStart = snapshot?.plant.productionDayStart ?? '06:00';
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
        filter: {},
        ...(search.preview !== undefined && { preview: search.preview }),
      })
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error ?? new Error('The board could not be loaded'));
      });
    return () => {
      cancelled = true;
    };
  }, [source, range.fromMs, range.toMs, attempt, search.preview]);

  const model = useMemo(
    () => (snapshot === undefined ? undefined : boardModelOf(snapshot, range)),
    [snapshot, range],
  );
  const machineWidth = Math.min(machineColumnPx, Math.floor(width * machineColumnShare));
  const timeWidth = Math.max(width - machineWidth - 2, Math.ceil(naturalWidthPx(range, zoom)));
  const scale = useMemo(
    () => createTimeScale({ range, zoom, timeZone, widthPx: timeWidth }),
    [range, zoom, timeZone, timeWidth],
  );
  const cells = useMemo(() => {
    const byMachine = new Map<string, readonly BoardCellItem[]>();
    for (const group of model?.groups ?? []) {
      for (const machine of group.machines) {
        byMachine.set(machine.equipment.code, cellsOf(machine.blocks, scale));
      }
    }
    return byMachine;
  }, [model, scale]);
  const lines = useMemo(
    () => (model === undefined ? [] : linesOf(model, cells, collapsed)),
    [model, cells, collapsed],
  );
  const known = (key: string | undefined) =>
    key !== undefined &&
    lines.some((line) => line.header === key || line.cells.some((cell) => cell.key === key));
  // Tab enters at the focused target while it is drawn, else at the selected order's first job
  // order, else at the job order nearest now (design D3, Keyboard model).
  const selectedEntry =
    model === undefined || search.order === undefined
      ? undefined
      : [
          ...model.notPlaced,
          ...model.groups.flatMap((group) => group.machines.flatMap((machine) => machine.blocks)),
        ]
          .filter((row) => row.order.id === search.order)
          .map((row) => focusKeys.block(row.jobOrder.id))
          .find((key) => known(key));
  const tabStop = known(focused)
    ? focused
    : (selectedEntry ?? (snapshot === undefined ? undefined : boardEntry(lines, snapshot.nowMs)));
  const selectOrder = (orderId: string | undefined) => {
    if (orderId !== search.order) void setSearch(withOrder(search, orderId), 'push');
  };

  const view = useMemo<GanttViewContext | undefined>(() => {
    if (snapshot === undefined) return undefined;
    const equipment = new Map(snapshot.equipment.map((machine) => [machine.code, machine]));
    const plantClosed = closedWindows(snapshot.calendar, timeZone, range);
    return {
      snapshot,
      scale,
      closedWindows: plantClosed,
      // A machine's own closed time, from its availability, as its row shades it.
      closedWindowsOf: (code) =>
        model?.groups
          .flatMap((group) => group.machines)
          .find((machine) => machine.equipment.code === code)?.closed ?? plantClosed,
      timeZone,
      zoneLabel: Intl.DateTimeFormat().resolvedOptions().timeZone !== timeZone,
      hideClosed: false,
      selectedOrderId: search.order,
      selectedOrderIds: new Set(search.order === undefined ? [] : [search.order]),
      chainRowIds: new Set(),
      machineName: (code) =>
        code === undefined ? 'no machine' : (equipment.get(code)?.name ?? code),
    };
  }, [snapshot, scale, timeZone, range, search.order, model]);

  // A target takes focus and scrolls into view past the sticky axes, which the scroll padding keeps
  // clear (WCAG 2.4.11). A target in the sticky machine column or the pinned Not placed row is in
  // view along that axis already, so the grid keeps its position there.
  const focusTarget = (key: string) => {
    setFocused(key);
    const element = document.querySelector<HTMLElement>(`[data-board-focus="${CSS.escape(key)}"]`);
    if (element === null) return;
    element.focus({ preventScroll: true });
    const grid = element.closest<HTMLElement>('[role="grid"]');
    const kept = { left: grid?.scrollLeft ?? 0, top: grid?.scrollTop ?? 0 };
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (grid === null) return;
    if (element.closest('[data-sticky-column]') !== null) grid.scrollLeft = kept.left;
    if (element.closest('[data-pinned-row]') !== null) grid.scrollTop = kept.top;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).getAttribute('data-board-focus');
    if (key === null) return;
    // A key with a modifier belongs to the browser and to the commands of later stories.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // The Escape stack (plan 07): the selection is the last layer the grid ends.
    if (event.key === 'Escape' && search.order !== undefined) {
      event.preventDefault();
      selectOrder(undefined);
      return;
    }
    const next = boardFocusAfter(lines, key, event.key);
    if (next === undefined) return;
    event.preventDefault();
    focusTarget(next);
  };

  // The page states of design D3 (DR17 to DR22): loading draws the grid's skeleton; no access and
  // no machines to plan replace the board and its toolbar.
  const forbidden = snapshot === undefined && loadError instanceof PlanningForbidden;
  const noMachines = model !== undefined && model.groups.length === 0;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = {
      status: 'empty',
      icon: ShieldOff,
      title: 'You cannot see the planning board at this plant',
      description:
        'The board needs the permission planning.jobOrder:read, and your role at this plant does not include it. Ask your plant admin for the Planner or Viewer role.',
    };
  } else if (loadError !== undefined) {
    // A failed load shows the error, also when the range before is still in memory: its rows
    // would read as a range without job orders.
    state = {
      status: 'error',
      title: 'The board could not be loaded',
      description:
        'Your draft and the saved plan are not affected. Try again. If the error comes back, give your plant admin the correlation id.',
      error: loadError,
      onRetry: async () => setAttempt((count) => count + 1),
    };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (noMachines) {
    state = {
      status: 'empty',
      icon: Drill,
      title: 'No machines to plan at this plant yet',
      description:
        'The board shows the machines marked as plannable. A plant admin adds machines in Machines and marks them there.',
      action: (
        <Link
          to={coreLinks.machines({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Open Machines
        </Link>
      ),
    };
  }
  const label = rangeLabel(range, zoom, timeZone);
  const gridName = `${plant} board, ${label}`;

  return (
    <PageFrame
      title="Planning board"
      meta={
        snapshot?.erp === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            ERP data as of {plantTime(snapshot, snapshot.erp.importedAtMs)}
          </span>
        )
      }
      state={state}
      toolbar={
        forbidden || noMachines ? undefined : (
          <div role="toolbar" aria-label="Board" className="flex flex-wrap items-center gap-2">
            <RangeControls
              presetLabel="Zoom"
              zoom={zoom}
              onZoomChange={(next) => void setSearch(withZoom(search, next))}
              from={from}
              onFromChange={(next) => void setSearch(withFrom(search, next))}
              onEarlier={() => void setSearch(withFrom(search, shiftedFrom(from, zoom, 'earlier')))}
              onNow={() =>
                void setSearch(
                  withFrom(search, plantDateOf(snapshot?.nowMs ?? Date.now(), timeZone)),
                )
              }
              onLater={() => void setSearch(withFrom(search, shiftedFrom(from, zoom, 'later')))}
              rangeLabel={label}
            />
          </div>
        )
      }
    >
      {snapshot?.fixture !== undefined && (
        <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
      )}
      {state.status === 'loading' && <BoardSkeleton name={gridName} machineWidth={machineWidth} />}
      {view !== undefined &&
        snapshot !== undefined &&
        model !== undefined &&
        !noMachines &&
        loadError === undefined && (
          <GanttViewProvider value={view}>
            <div ref={fillRef} className="flex min-w-0 flex-col">
              <BoardGrid
                name={gridName}
                snapshot={snapshot}
                model={model}
                cellsOf={(code) => cells.get(code) ?? []}
                scale={scale}
                machineWidth={machineWidth}
                timeWidth={timeWidth}
                collapsed={collapsed}
                onToggleGroup={(code) =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(code)) next.delete(code);
                    else next.add(code);
                    return next;
                  })
                }
                tabStop={tabStop}
                selectedOrderId={search.order}
                onSelectOrder={selectOrder}
                onFocusTarget={setFocused}
                onKeyDown={onKeyDown}
                gridRef={measureRef}
                height={fillHeight}
              />
            </div>
          </GanttViewProvider>
        )}
    </PageFrame>
  );
}
