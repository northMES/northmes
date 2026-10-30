// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { classifyError, useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Drill, Pencil, ShieldOff } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { useBoardFields } from '../../board-fields-store.ts';
import { MoveDialog } from '../../components/move-dialog/index.ts';
import {
  RangeControls,
  VisibleSpanText,
  ZoomControls,
} from '../../components/range-controls/index.ts';
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
  moveInDraft,
  orderNumbersText,
  splitRunInDraft,
} from '../../gantt-draft.ts';
import {
  type BoardSearch,
  boardSearch,
  startOfFrom,
  withFrom,
  withOrder,
  withZoom,
} from '../../gantt-search.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import { useMoveOf } from '../../move-store.ts';
import { plantTime } from '../../order-facts.ts';
import { usePlanningDraft } from '../../planning-draft.tsx';
import { PlanningForbidden } from '../../planning-preview.ts';
import { closedWindows } from '../../timeline/availability-shading.ts';
import { plantDateOf, spanLabel, zoomLevels } from '../../timeline/time-scale.ts';
import { useTimeBuffer } from '../../timeline/use-time-buffer.ts';
import { useTimelineZoom } from '../../timeline/use-timeline-zoom.ts';
import { useMeasuredWidth, useViewportFill } from '../../use-grid-size.ts';
import { useMoveActions } from '../../use-move-actions.ts';
import { type GanttViewContext, GanttViewProvider } from '../gantt/gantt-context.ts';
import { GanttDetailDrawer } from '../gantt/gantt-detail-panel.tsx';
import { changesText, GanttDraftDrawer } from '../gantt/gantt-draft-drawer.tsx';
import { movedMessage, previewOf, refusalMessage } from '../gantt/gantt-move.ts';
import { BlockMenu } from './board-block-menu.tsx';
import { type BoardCellItem, cellsOf } from './board-cells.ts';
import { BoardGrid, focusKeys } from './board-grid.tsx';
import { type BoardLine, boardEntry, boardFocusAfter } from './board-navigation.ts';
import { type BoardModel, boardFitTargetOf, boardModelOf } from './board-rows.ts';
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
  const [committed, setCommitted] = useState<GanttSnapshot | undefined>(undefined);
  /** The range the snapshot was loaded for, so a range still loading reads as busy. */
  const [loadedRange, setLoadedRange] = useState<string | undefined>(undefined);
  // The planner's draft, which the Gantt and the job order table share (plan 07, Drafts).
  const [draft, setDraft] = usePlanningDraft();
  const [draftOpen, setDraftOpen] = useState(false);
  /** The element that opened the My draft drawer, which takes focus back when it closes. */
  const draftOpener = useRef<HTMLElement | undefined>(undefined);
  // The block menu at its block, and the job order the Move dialog moves (design D3, IN7 and IN8).
  const [menu, setMenu] = useState<{ jobOrderId: string; anchor: HTMLElement } | undefined>(
    undefined,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  // The job order stays after the dialog closes, so the dialog fades out with its content.
  const [moveDialogFor, setMoveDialogFor] = useState<string | undefined>(undefined);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  /** Settles the promise of Try again once the load it started has settled. */
  const retryDone = useRef<(() => void) | undefined>(undefined);
  // A change of the preview drops the board shown before, so the state it asks for shows at once.
  const [shownPreview, setShownPreview] = useState(search.preview);
  if (shownPreview !== search.preview) {
    setShownPreview(search.preview);
    setCommitted(undefined);
    setLoadError(undefined);
  }
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | undefined>(undefined);
  const [width, measureRef] = useMeasuredWidth();
  const urlZoom = search.zoom ?? defaultZoom;
  const [fillHeight, fillRef] = useViewportFill(`${urlZoom}|${search.from ?? ''}`);

  const timeZone = committed?.plant.timeZone ?? 'UTC';
  const productionDayStart = committed?.plant.productionDayStart ?? '06:00';
  const gridElement = useRef<HTMLDivElement | null>(null);
  // One ref for the grid, kept across renders, so the width is not measured again on each one.
  const boardGridRef = useCallback(
    (node: HTMLDivElement | null) => {
      gridElement.current = node;
      measureRef(node);
    },
    [measureRef],
  );
  const machineWidth = Math.min(machineColumnPx, Math.floor(width * machineColumnShare));
  const zoomPlant = useMemo(
    () => ({ timeZone, productionDayStart }),
    [timeZone, productionDayStart],
  );
  // The endless axis (ADR 0089): a buffer of three viewport widths that moves near an edge. A
  // pointer drag holds it, since the drag reads its moves in this buffer's pixels.
  const buffer = useTimeBuffer({
    zoom: urlZoom,
    from: search.from,
    nowMs: committed?.nowMs ?? Date.now(),
    widthPx: width,
    grid: gridElement,
    columns: { treeWidth: machineWidth, stickyWidth: machineWidth },
    plant: zoomPlant,
    // The level goes to the URL when it changes, so a default level stays out of it.
    onNavigate: (level, start) =>
      void setSearch(withFrom(level === urlZoom ? search : withZoom(search, level), start)),
    frozen: {
      get: () => moveStore.get()?.state.source === 'pointer',
      subscribe: (listener) => moveStore.subscribe(listener),
    },
  });
  const zoom = buffer.zoom;
  const range = buffer.range;
  const rangeKey = range === undefined ? undefined : `${range.fromMs}/${range.toMs}`;
  // The visible start, which the URL holds once scrolling stops and links to the other pages carry.
  const from = search.from ?? plantDateOf(committed?.nowMs ?? Date.now(), timeZone);

  useEffect(() => {
    if (range === undefined) return;
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
        if (cancelled) return;
        setCommitted(loaded);
        setLoadedRange(`${range.fromMs}/${range.toMs}`);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error ?? new Error('The board could not be loaded'));
      })
      .finally(() => {
        if (cancelled) return;
        retryDone.current?.();
        retryDone.current = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [source, range, attempt, search.preview]);

  // Everything the board draws reads the plan with the draft applied, analysed over the buffer.
  const snapshot = useMemo(
    () =>
      committed === undefined || range === undefined
        ? undefined
        : applyDraft(committed, draft, range),
    [committed, draft, range],
  );
  const draftIds = useMemo(() => draftRowIds(draft), [draft]);
  const conflicts = useMemo(
    () => (snapshot === undefined ? [] : draftConflicts(snapshot, draft)),
    [snapshot, draft],
  );
  const model = useMemo(
    () =>
      snapshot === undefined || range === undefined ? undefined : boardModelOf(snapshot, range),
    [snapshot, range],
  );
  const scale = buffer.scale;
  const timeWidth = Math.ceil(scale?.widthPx ?? 0);
  const timelineZoom = useTimelineZoom({
    buffer,
    grid: gridElement,
    plant: zoomPlant,
    dragging: () => moveStore.get()?.state.source === 'pointer',
  });
  const cells = useMemo(() => {
    const byMachine = new Map<string, readonly BoardCellItem[]>();
    if (scale === undefined) return byMachine;
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
  // A job order of the selected order inside a cluster enters at its cluster.
  const selectedEntry =
    model === undefined || search.order === undefined
      ? undefined
      : [
          ...model.notPlaced.map((row) => ({ key: focusKeys.block(row.jobOrder.id), rows: [row] })),
          ...[...cells.values()].flatMap((row) =>
            row.map((cell) =>
              cell.kind === 'cluster'
                ? { key: cell.key, rows: cell.rows }
                : { key: focusKeys.block(cell.row.jobOrder.id), rows: [cell.row] },
            ),
          ),
        ]
          .filter((target) => target.rows.some((row) => row.order.id === search.order))
          .map((target) => target.key)
          .find((key) => known(key));
  const tabStop = known(focused)
    ? focused
    : (selectedEntry ?? (snapshot === undefined ? undefined : boardEntry(lines, snapshot.nowMs)));
  const selectOrder = (orderId: string | undefined) => {
    if (orderId !== search.order) void setSearch(withOrder(search, orderId), 'push');
  };
  // Details of a job order in the Gantt's drawer (Krister, 2026-10-21): a double click or Enter
  // opens it and selects the order (#886), and a link that names an order opens its first job
  // order in the range.
  const [detailFor, setDetailFor] = useState<string | undefined>(undefined);
  /** The block that takes focus when the drawer closes. */
  const detailReturn = useRef<string | undefined>(undefined);
  const allRows = useMemo(
    () =>
      model === undefined
        ? []
        : [
            ...model.groups.flatMap((group) => group.machines.flatMap((machine) => machine.blocks)),
            ...model.notPlaced,
          ],
    [model],
  );
  const openDetails = (jobOrderId: string) => {
    const row = allRows.find((each) => each.jobOrder.id === jobOrderId);
    if (row === undefined) return;
    selectOrder(row.order.id);
    detailReturn.current = jobOrderId;
    setDetailFor(jobOrderId);
  };
  const detailRow =
    detailFor === undefined ? undefined : allRows.find((row) => row.jobOrder.id === detailFor);
  // The target that takes focus when Details closes: the block, else the cluster that holds it.
  const detailTarget = (jobOrderId: string): HTMLElement | null => {
    const byKey = (key: string) =>
      document.querySelector<HTMLElement>(`[data-board-focus="${CSS.escape(key)}"]`);
    const cluster = [...cells.values()]
      .flat()
      .find(
        (cell) =>
          cell.kind === 'cluster' && cell.rows.some((row) => row.jobOrder.id === jobOrderId),
      );
    return (
      byKey(focusKeys.block(jobOrderId)) ??
      (cluster === undefined
        ? null
        : byKey(cluster.kind === 'cluster' ? cluster.key : focusKeys.block(jobOrderId)))
    );
  };
  // Details closes when its job order leaves the board, and when Back or Forward changes the
  // selected order away from its order.
  useEffect(() => {
    if (detailFor !== undefined && detailRow === undefined) setDetailFor(undefined);
  }, [detailFor, detailRow]);
  const previousOrder = useRef(search.order);
  useEffect(() => {
    const before = previousOrder.current;
    previousOrder.current = search.order;
    if (before !== search.order && detailRow !== undefined && detailRow.order.id !== search.order) {
      setDetailFor(undefined);
    }
  }, [search.order, detailRow]);
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current || model === undefined) return;
    openedFromLink.current = true;
    // The order's first operation in the range: by operation sequence, then by setup start.
    const first = allRows
      .filter((row) => row.order.id === search.order)
      .sort(
        (a, b) =>
          a.operation.sequence - b.operation.sequence ||
          (a.jobOrder.placement?.setupStartMs ?? Number.MAX_SAFE_INTEGER) -
            (b.jobOrder.placement?.setupStartMs ?? Number.MAX_SAFE_INTEGER),
      )[0];
    if (first === undefined) return;
    detailReturn.current = first.jobOrder.id;
    setDetailFor(first.jobOrder.id);
  }, [model, allRows, search.order]);

  const boardFields = useBoardFields(plant);
  // Up and Down in move mode step through the allowed machines in the board's row order, past the
  // machines of collapsed groups (plan 07, Moving without dragging).
  const machineSteps = (allowed: readonly string[]) =>
    (model?.groups ?? [])
      .filter((group) => !collapsed.has(group.code))
      .flatMap((group) => group.machines.map((machine) => machine.equipment.code))
      .filter((code) => allowed.includes(code));
  // A job order that takes focus after a move but is not drawn yet: it may lie outside the range
  // or inside a cluster (plan 07: range extension follows the move, and focus returns by id).
  const [pendingFocus, setPendingFocus] = useState<string | undefined>(undefined);
  const { actions: moveActions, store: moveStore } = useMoveActions({
    committed,
    snapshot,
    draft,
    setDraft,
    cascadeOn: true,
    zoom,
    timeZone,
    focusBlock: (jobOrderId) => {
      if (!focusTarget(focusKeys.block(jobOrderId))) setPendingFocus(jobOrderId);
    },
    machineSteps,
  });
  const preview = useMoveOf(moveStore, (move) => move?.preview);

  // The Move dialog's job order, and the block that takes focus when it closes.
  const moveDialogReturn = useRef<string | undefined>(undefined);
  const moveDialogRow =
    moveDialogFor === undefined || model === undefined
      ? undefined
      : model.groups
          .flatMap((group) => group.machines.flatMap((machine) => machine.blocks))
          .find((row) => row.jobOrder.id === moveDialogFor);
  // Move in the dialog goes through the same draft move as a drag (plan 07, Moving without
  // dragging), with its announcement, and focus returns to the block by id.
  const moveFromDialog = (jobOrderId: string, equipment: string, setupStartMs: number) => {
    if (committed === undefined || snapshot === undefined) return;
    const preview = previewOf(
      snapshot,
      { jobOrderId, setupStartMs, equipment, source: 'keyboard' },
      true,
    );
    const { draft: next, result } = moveInDraft(
      committed,
      draft,
      { jobOrderId, setupStartMs, equipment },
      { cascade: true },
    );
    if (result.refused !== undefined || preview === undefined) {
      if (result.refused !== undefined && preview !== undefined) {
        announce(refusalMessage(preview.displayNumber, result.refused));
      }
      return;
    }
    setDraft(next);
    const machine = snapshot.equipment.find((each) => each.code === equipment)?.name ?? equipment;
    announce(movedMessage(preview, machine, timeZone));
    // Focus returns to the block by id; a block outside the range moves the range to it.
    requestAnimationFrame(() => {
      if (!focusTarget(focusKeys.block(jobOrderId))) setPendingFocus(jobOrderId);
    });
  };

  const view = useMemo<GanttViewContext | undefined>(() => {
    if (snapshot === undefined || scale === undefined || range === undefined) return undefined;
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
      draftRowIds: draftIds,
      ...(moveActions !== undefined && { move: moveActions }),
      boardFields,
    };
  }, [snapshot, scale, timeZone, range, search.order, draftIds, moveActions, model, boardFields]);

  // A target takes focus and scrolls into view past the sticky axes, which the scroll padding keeps
  // clear (WCAG 2.4.11). A target in the sticky machine column or the pinned Not placed row is in
  // view along that axis already, so the grid keeps its position there.
  /** Moves focus to a target of the grid; false when it is not drawn. */
  function focusTarget(key: string): boolean {
    const element = document.querySelector<HTMLElement>(`[data-board-focus="${CSS.escape(key)}"]`);
    if (element === null) return false;
    setFocused(key);
    element.focus({ preventScroll: true });
    const grid = element.closest<HTMLElement>('[role="grid"]');
    const kept = { left: grid?.scrollLeft ?? 0, top: grid?.scrollTop ?? 0 };
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (grid === null) return true;
    if (element.closest('[data-sticky-column]') !== null) grid.scrollLeft = kept.left;
    if (element.closest('[data-pinned-row]') !== null) grid.scrollTop = kept.top;
    return true;
  }
  useEffect(() => {
    if (pendingFocus === undefined || snapshot === undefined) return;
    if (focusTarget(focusKeys.block(pendingFocus))) {
      setPendingFocus(undefined);
      return;
    }
    const cluster = [...cells.values()]
      .flat()
      .find(
        (cell) =>
          cell.kind === 'cluster' && cell.rows.some((row) => row.jobOrder.id === pendingFocus),
      );
    if (cluster !== undefined) {
      focusTarget(cluster.kind === 'cluster' ? cluster.key : focusKeys.block(pendingFocus));
      setPendingFocus(undefined);
      return;
    }
    const start = snapshot.productionOrders
      .flatMap((order) => order.jobOrders)
      .find((row) => row.id === pendingFocus)?.placement?.setupStartMs;
    if (
      start === undefined ||
      range === undefined ||
      (start >= range.fromMs && start < range.toMs)
    ) {
      setPendingFocus(undefined);
      return;
    }
    // The buffer is rebuilt around the job order, which then draws and takes focus.
    buffer.goTo(zoom, { ms: start, viewportX: machineWidth + (width - machineWidth) / 2 });
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).getAttribute('data-board-focus');
    if (key === null) return;
    // Minus and plus step a level around the centre of the view (ADR 0089); plus may need Shift.
    if (timelineZoom.onKeyDown(event)) {
      event.preventDefault();
      return;
    }
    // A key with a modifier belongs to the browser and to the commands of later stories.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // The Escape stack (plan 07): a move still in progress ends first, the selection last.
    if (event.key === 'Escape' && moveActions !== undefined && moveStore.get() !== undefined) {
      event.preventDefault();
      moveActions.cancel();
      return;
    }
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
  // A refusal shows no access also when a range before is still in memory: the mock source's
  // refusal, or the API's FORBIDDEN of a server source.
  const forbidden =
    loadError !== undefined &&
    (loadError instanceof PlanningForbidden || classifyError(loadError).page === 'forbidden');
  const noMachines = model !== undefined && model.groups.length === 0;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = {
      status: 'empty',
      icon: ShieldOff,
      title: 'You cannot see the planning board at this plant',
      description:
        'The board needs the permission planning.jobOrder:read, and your role at this plant does not include it. Ask your plant admin for the Planner or Viewer role.',
      // D3 draws no action on DR22, and the toolbar stays hidden. The job table and the order
      // Gantt need the same permission, so the way out is the plant dashboard, which needs none.
      action: (
        <Link
          to={coreLinks.dashboard({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Open the dashboard
        </Link>
      ),
    };
  } else if (loadError !== undefined) {
    // A failed load shows the error, also when the range before is still in memory: its rows
    // would read as a range without job orders.
    state = {
      status: 'error',
      title: 'The board could not be loaded',
      description:
        'Your draft and the saved plan are not affected. Try again, or open the job table for the same range.',
      error: loadError,
      onRetry: () =>
        new Promise<void>((resolve) => {
          retryDone.current = resolve;
          setAttempt((count) => count + 1);
        }),
      action: (
        <Link
          to={planningLinks.jobOrders({ plant }, { zoom, from }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Open the job table
        </Link>
      ),
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
  const gridName = [
    `${plant} board`,
    ...(buffer.settled === undefined ? [] : [spanLabel(buffer.settled, zoom, timeZone)]),
  ].join(', ');
  // The grid, My draft and the drawers show only with a drawn board.
  const gridShown =
    view !== undefined &&
    snapshot !== undefined &&
    model !== undefined &&
    !noMachines &&
    loadError === undefined;

  return (
    <PageFrame
      title="Planning board"
      meta={
        snapshot?.erp === undefined || noMachines ? undefined : (
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
              zoomControls={
                <ZoomControls
                  zoom={zoom}
                  onZoomChange={timelineZoom.setLevel}
                  onZoomToFit={() => {
                    if (snapshot === undefined) return;
                    const target = boardFitTargetOf(snapshot, search.order);
                    timelineZoom.fit(target.span, target.name);
                  }}
                />
              }
              from={from.slice(0, 10)}
              onFromChange={(next) =>
                buffer.goTo(zoom, {
                  ms: startOfFrom(next, zoom, timeZone, productionDayStart),
                  viewportX: machineWidth,
                })
              }
              onEarlier={() => buffer.page('earlier')}
              onNow={() => timelineZoom.goTo(snapshot?.nowMs ?? Date.now())}
              onLater={() => buffer.page('later')}
              rangeLabel={
                <VisibleSpanText visible={buffer.visible} zoom={zoom} timeZone={timeZone} />
              }
            />
            <span className="grow" />
            {gridShown && (
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
            )}
          </div>
        )
      }
    >
      {snapshot?.fixture !== undefined && (
        <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
      )}
      {state.status === 'loading' && (
        <BoardSkeleton name={gridName} machineWidth={machineWidth} gridRef={measureRef} />
      )}
      {gridShown &&
        view !== undefined &&
        snapshot !== undefined &&
        model !== undefined &&
        scale !== undefined && (
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
                onOpenDetails={openDetails}
                onBlockMenu={(jobOrderId, anchor) => {
                  setMenu({ jobOrderId, anchor });
                  setMenuOpen(true);
                }}
                onFocusTarget={setFocused}
                onKeyDown={onKeyDown}
                gridRef={boardGridRef}
                height={fillHeight}
                busy={loadedRange !== rangeKey}
                onScroll={buffer.onScroll}
              />
            </div>
            <BlockMenu
              menu={menu}
              open={menuOpen}
              snapshot={snapshot}
              plant={plant}
              onClose={() => setMenuOpen(false)}
              onMove={(jobOrderId) => {
                setMenuOpen(false);
                moveDialogReturn.current = jobOrderId;
                setMoveDialogFor(jobOrderId);
                setMoveDialogOpen(true);
              }}
            />
            <MoveDialog
              open={moveDialogOpen}
              row={moveDialogRow}
              snapshot={snapshot}
              machineName={view.machineName}
              stepMs={zoomLevels[zoom].stepMs}
              presetLabel={zoomLevels[zoom].label}
              onMove={(equipment, setupStartMs) => {
                if (moveDialogFor === undefined) return;
                setMoveDialogOpen(false);
                moveFromDialog(moveDialogFor, equipment, setupStartMs);
              }}
              onCancel={() => setMoveDialogOpen(false)}
              finalFocus={() =>
                moveDialogReturn.current === undefined
                  ? null
                  : document.querySelector<HTMLElement>(
                      `[data-board-focus="${CSS.escape(moveDialogReturn.current)}"]`,
                    )
              }
            />
            <GanttDetailDrawer
              row={detailRow}
              chain={undefined}
              onClose={() => {
                // A move begun in Details ends with it, without a change (plan 07, the Escape stack).
                if (moveStore.get() !== undefined) moveActions?.cancel({ refocus: false });
                setDetailFor(undefined);
              }}
              // The board draws no chain: Show critical chain opens the order's chain on the Gantt.
              onToggleChain={(orderId) =>
                void navigate({
                  href: planningLinks.gantt({ plant }, { zoom, from, order: orderId, chain: '1' })
                    .href,
                })
              }
              onFocusRow={(jobOrderId) => {
                detailReturn.current = jobOrderId;
                setDetailFor(undefined);
              }}
              onMoveApplied={(jobOrderId) => {
                detailReturn.current = jobOrderId;
                setDetailFor(undefined);
              }}
              finalFocus={() =>
                detailReturn.current === undefined ? null : detailTarget(detailReturn.current)
              }
            />
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
              onSplitRun={(runId) => {
                const run = draft.runs.find((each) => each.id === runId);
                setDraft(splitRunInDraft(draft, runId));
                if (run !== undefined) {
                  announce(
                    `Run of ${run.article} split; ${orderNumbersText(run.orderNumbers)} are separate orders again.`,
                  );
                }
              }}
              onDiscardDraft={() => setDraft(emptyDraft)}
              finalFocus={() => draftOpener.current ?? null}
            />
          </GanttViewProvider>
        )}
    </PageFrame>
  );
}
