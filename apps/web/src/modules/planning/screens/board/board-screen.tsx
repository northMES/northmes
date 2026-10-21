// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Drill, Pencil, ShieldOff } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { RangeControls } from '../../components/range-controls/index.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import {
  applyDraft,
  cascadeFromHere,
  type DraftConflict,
  discardChange,
  draftChangeCount,
  draftConflicts,
  draftRowIds,
  emptyDraft,
  moveBack,
  splitRunInDraft,
} from '../../gantt-draft.ts';
import {
  type BoardSearch,
  boardSearch,
  withFrom,
  withOrder,
  withZoom,
} from '../../gantt-search.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import { plantTime } from '../../order-facts.ts';
import { usePlanningDraft } from '../../planning-draft.tsx';
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
import { useMoveActions } from '../../use-move-actions.ts';
import { type GanttViewContext, GanttViewProvider } from '../gantt/gantt-context.ts';
import { changesText, GanttDraftDrawer } from '../gantt/gantt-draft-drawer.tsx';
import { refusalMessage } from '../gantt/gantt-move.ts';
import { type BoardCellItem, cellsOf } from './board-cells.ts';
import { BoardGrid, focusKeys } from './board-grid.tsx';
import { type BoardLine, boardEntry, boardFocusAfter } from './board-navigation.ts';
import { type BoardModel, boardModelOf } from './board-rows.ts';
import { BoardSkeleton } from './board-skeleton.tsx';

/** The board opens at Week, as the Gantt and the job order table do (D5; D3 open question 1). */
const defaultZoom = 'week';

/** The machine column of D3: about 200 px, never more than 40 percent of the grid (plan 07). */
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
  const [committed, setCommitted] = useState<GanttSnapshot | undefined>(undefined);
  // The planner's draft, which the Gantt and the job order table share (plan 07, Drafts).
  const [draft, setDraft] = usePlanningDraft();
  const [draftOpen, setDraftOpen] = useState(false);
  /** The element that opened the My draft drawer, which takes focus back when it closes. */
  const draftOpener = useRef<HTMLElement | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | undefined>(undefined);
  const [width, measureRef] = useMeasuredWidth();
  const zoom = search.zoom ?? defaultZoom;
  const [fillHeight, fillRef] = useViewportFill(`${zoom}|${search.from ?? ''}`);

  const timeZone = committed?.plant.timeZone ?? 'UTC';
  const productionDayStart = committed?.plant.productionDayStart ?? '06:00';
  const from =
    search.from ??
    (committed === undefined
      ? plantDateOf(Date.now(), timeZone)
      : plantDateOf(committed.nowMs, timeZone));
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
        if (!cancelled) setCommitted(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error ?? new Error('The board could not be loaded'));
      });
    return () => {
      cancelled = true;
    };
  }, [source, range.fromMs, range.toMs, attempt, search.preview]);

  // Everything the board draws reads the plan with the draft applied, analysed over the range.
  const snapshot = useMemo(
    () => (committed === undefined ? undefined : applyDraft(committed, draft, range)),
    [committed, draft, range],
  );
  const draftIds = useMemo(() => draftRowIds(draft), [draft]);
  const conflicts = useMemo(
    () => (snapshot === undefined ? [] : draftConflicts(snapshot, draft)),
    [snapshot, draft],
  );
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

  // Up and Down in move mode step through the allowed machines in the board's row order, past the
  // machines of collapsed groups (plan 07, Moving without dragging).
  const machineSteps = (allowed: readonly string[]) =>
    lines.flatMap((line) => {
      const code = line.kind === 'machine' ? line.header?.slice('header:'.length) : undefined;
      return code !== undefined && allowed.includes(code) ? [code] : [];
    });
  const { actions: moveActions, preview } = useMoveActions({
    committed,
    snapshot,
    draft,
    setDraft,
    cascadeOn: true,
    zoom,
    range,
    timeZone,
    focusBlock: (jobOrderId) => focusTarget(focusKeys.block(jobOrderId)),
    machineSteps,
  });

  const view = useMemo<GanttViewContext | undefined>(() => {
    if (snapshot === undefined) return undefined;
    const equipment = new Map(snapshot.equipment.map((machine) => [machine.code, machine]));
    const plantClosed = closedWindows(snapshot.calendar, timeZone, range);
    return {
      snapshot,
      scale,
      closedWindows: plantClosed,
      closedWindowsOf: () => plantClosed,
      timeZone,
      zoneLabel: Intl.DateTimeFormat().resolvedOptions().timeZone !== timeZone,
      hideClosed: false,
      selectedOrderId: search.order,
      selectedOrderIds: new Set(search.order === undefined ? [] : [search.order]),
      chainRowIds: new Set(),
      machineName: (code) =>
        code === undefined ? 'no machine' : (equipment.get(code)?.name ?? code),
      draftRowIds: draftIds,
      ...(moveActions !== undefined && { move: moveActions }),
    };
  }, [snapshot, scale, timeZone, range, search.order, draftIds, moveActions]);

  function focusTarget(key: string) {
    setFocused(key);
    const element = document.querySelector<HTMLElement>(`[data-board-focus="${key}"]`);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).getAttribute('data-board-focus');
    if (key === null) return;
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
  const forbidden = committed === undefined && loadError instanceof PlanningForbidden;
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
  } else if (snapshot === undefined && loadError !== undefined) {
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
            <span className="grow" />
            <Button
              variant="outline"
              className="h-8 px-3"
              data-draft-button
              onClick={() => {
                draftOpener.current = document.activeElement as HTMLElement | undefined;
                setDraftOpen(true);
              }}
            >
              <Pencil aria-hidden />
              {draftChangeCount(draft) === 0
                ? 'My draft'
                : `My draft, ${changesText(draftChangeCount(draft))}`}
            </Button>
          </div>
        )
      }
    >
      {snapshot?.fixture !== undefined && (
        <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
      )}
      {state.status === 'loading' && <BoardSkeleton name={gridName} machineWidth={machineWidth} />}
      {view !== undefined && snapshot !== undefined && model !== undefined && !noMachines && (
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
              {...(preview !== undefined && { preview })}
              selectedOrderId={search.order}
              onSelectOrder={selectOrder}
              onFocusTarget={setFocused}
              onKeyDown={onKeyDown}
              gridRef={measureRef}
              height={fillHeight}
            />
          </div>
          <GanttDraftDrawer
            open={draftOpen}
            onClose={() => setDraftOpen(false)}
            draft={draft}
            conflicts={conflicts}
            timeZone={timeZone}
            machineName={view.machineName}
            onCascadeFromHere={(conflict: DraftConflict) => {
              if (committed === undefined) return;
              const { draft: next, refused } = cascadeFromHere(committed, draft, conflict);
              if (refused !== undefined) announce(refusalMessage(conflict.rows[0], refused));
              else setDraft(next);
            }}
            onMoveBack={(conflict: DraftConflict) => setDraft(moveBack(draft, conflict))}
            onDiscardChange={(jobOrderId) => setDraft(discardChange(draft, jobOrderId))}
            onSplitRun={(runId) => setDraft(splitRunInDraft(draft, runId))}
            onDiscardDraft={() => setDraft(emptyDraft)}
            finalFocus={() => draftOpener.current ?? null}
          />
        </GanttViewProvider>
      )}
    </PageFrame>
  );
}
