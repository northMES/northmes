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
import {
  ChunkBands,
  ChunkStatus,
  RowsStatus,
  unloadedChunks,
} from '../../components/chunk-status/index.ts';
import { MoveDialog } from '../../components/move-dialog/index.ts';
import { OrderFilterField } from '../../components/order-filter/index.ts';
import { ZoomOverlay } from '../../components/range-controls/index.ts';
import { type GanttPageRequest, ganttMaxOrders } from '../../gantt-data.ts';
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
import { loadedSnapshot } from '../../gantt-loaded.ts';
import {
  type BoardSearch,
  boardSearch,
  defaultZoom,
  droppedKeyMessage,
  matchesOrderFilter,
  withFrom,
  withOrder,
  withQuery,
  withZoom,
} from '../../gantt-search.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import { useMoveOf, useNotAllowed } from '../../move-store.ts';
import { plantTime } from '../../order-facts.ts';
import { usePlanningDraft } from '../../planning-draft.tsx';
import { PlanningForbidden } from '../../planning-preview.ts';
import { closedWindows } from '../../timeline/availability-shading.ts';
import { plantDateOf, spanLabel, type TimeRange, zoomLevels } from '../../timeline/time-scale.ts';
import { useTimeBuffer } from '../../timeline/use-time-buffer.ts';
import { useTimeChunks } from '../../timeline/use-time-chunks.ts';
import { useTimelineZoom } from '../../timeline/use-timeline-zoom.ts';
import { useGanttRows } from '../../use-gantt-rows.ts';
import { useMeasuredWidth, useViewportFill } from '../../use-grid-size.ts';
import { useMoveActions } from '../../use-move-actions.ts';
import { type GanttViewContext, GanttViewProvider } from '../gantt/gantt-context.ts';
import { GanttDetailDrawer } from '../gantt/gantt-detail-panel.tsx';
import { changesText, GanttDraftDrawer } from '../gantt/gantt-draft-drawer.tsx';
import { movedMessage, previewOf, refusalMessage, staysOverdue } from '../gantt/gantt-move.ts';
import type { JobOrderRow } from '../gantt/gantt-rows.ts';
import { timeHeaderHeightRem } from '../gantt/gantt-time-area.tsx';
import { BlockMenu } from './board-block-menu.tsx';
import { type BoardCellItem, cellsOf } from './board-cells.ts';
import { BoardGrid, boardRowRem, focusKeys } from './board-grid.tsx';
import {
  machineColumnBounds,
  machineColumnWidth,
  useMachineColumnWidth,
} from './board-machine-column.ts';
import {
  type BoardLine,
  boardEntry,
  boardFocusAfter,
  boardFocusInView,
} from './board-navigation.ts';
import { type BoardModel, boardFitTargetOf, boardModelOf } from './board-rows.ts';
import { BoardSkeleton } from './board-skeleton.tsx';

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
 * the order color, the pinned Not placed row, the slim bar and the zoom buttons over the time area
 * (ADR 0090). The
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
  // The row list, every page of it, since the board needs every order for its blocks, and the
  // job orders by time chunk (ADR 0089, Loading by time chunk). The preview is the mock source's
  // page state; a change of it drops the rows shown and loads everything again, so the state it
  // asks for shows at once.
  const loadOptions = useMemo(
    () => (search.preview === undefined ? {} : { preview: search.preview }),
    [search.preview],
  );
  const loadRows = useCallback(
    (page: GanttPageRequest) => source.loadRows({}, page, loadOptions),
    [source, loadOptions],
  );
  const loadChunk = useCallback(
    (from: string, to: string) => source.loadChunk(from, to, {}, loadOptions),
    [source, loadOptions],
  );
  const rowList = useGanttRows({ load: loadRows, all: true, resetKey: search.preview ?? '' });
  // The order filter decides what is drawn (ADR 0090): the machine rows stay, the job orders of
  // the orders whose number matches show, and its own row list of the matching orders names the
  // first match and says when nothing matches. The move rules keep every job order.
  const query = search.q ?? '';
  const loadMatching = useCallback(
    (page: GanttPageRequest) => source.loadRows({ search: query }, page, loadOptions),
    [source, query, loadOptions],
  );
  const matchList = useGanttRows({
    load: loadMatching,
    all: true,
    resetKey: search.preview ?? '',
    enabled: query !== '',
  });
  const frame = rowList.frame;
  const loadError = rowList.status === 'failed' ? rowList.error : undefined;
  // The planner's draft, which the Gantt and the job order table share (plan 07, Drafts).
  const [draft, setDraft] = usePlanningDraft();
  const [draftOpen, setDraftOpen] = useState(false);
  /** The element that opened the My draft drawer, which takes focus back when it closes. */
  const draftOpener = useRef<HTMLElement | undefined>(undefined);
  // The order filter's field, where focus goes when My draft leaves the bar or the filter clears.
  const filterInput = useRef<HTMLInputElement | null>(null);
  // The block menu at its block, and the job order the Move dialog moves (design D3, IN7 and IN8).
  const [menu, setMenu] = useState<{ jobOrderId: string; anchor: HTMLElement } | undefined>(
    undefined,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  // The job order stays after the dialog closes, so the dialog fades out with its content.
  const [moveDialogFor, setMoveDialogFor] = useState<string | undefined>(undefined);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  /** Settles the promise of Try again once the load it started has settled. */
  const retryDone = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (rowList.status === 'loading') return;
    retryDone.current?.();
    retryDone.current = undefined;
  }, [rowList.status]);
  // Details of a job order in the Gantt's drawer (Krister, 2026-10-21): a double click or Enter
  // opens it and selects the order (#886), and a link that names an order opens its first job
  // order in the range.
  const [detailFor, setDetailFor] = useState<string | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | undefined>(undefined);
  const [width, measureRef] = useMeasuredWidth();
  const urlZoom = search.zoom ?? defaultZoom;
  const [fillHeight, fillRef] = useViewportFill(`${urlZoom}|${search.from ?? ''}`);

  const timeZone = frame?.plant.timeZone ?? 'UTC';
  const productionDayStart = frame?.plant.productionDayStart ?? '06:00';
  const gridElement = useRef<HTMLDivElement | null>(null);
  // One ref for the grid, kept across renders, so the width is not measured again on each one.
  const boardGridRef = useCallback(
    (node: HTMLDivElement | null) => {
      gridElement.current = node;
      measureRef(node);
    },
    [measureRef],
  );
  // The machine column: 200 px or 40 percent of the grid, whichever is less, at least 140 px (plan 07), until the planner
  // resizes it by its header edge; the width stays in this browser (#943). D3 proposes fitting the
  // longest name between 168 and 272 px.
  const [keptMachineWidth, keepMachineWidth] = useMachineColumnWidth();
  const [draggedMachineWidth, setDraggedMachineWidth] = useState<number | undefined>(undefined);
  const machineWidth = machineColumnWidth(width, draggedMachineWidth ?? keptMachineWidth);
  const machineBounds = machineColumnBounds(width);
  const zoomPlant = useMemo(
    () => ({ timeZone, productionDayStart }),
    [timeZone, productionDayStart],
  );
  // The endless axis (ADR 0089): a buffer of three viewport widths that moves near an edge. A
  // pointer drag holds it, since the drag reads its moves in this buffer's pixels.
  const buffer = useTimeBuffer({
    zoom: urlZoom,
    from: search.from,
    nowMs: frame?.nowMs ?? Date.now(),
    widthPx: width,
    grid: gridElement,
    columns: { treeWidth: machineWidth, stickyWidth: machineWidth },
    plant: zoomPlant,
    // The zoom goes to the URL with the start, and the default zoom stays out of it.
    onNavigate: (next, start) => void setSearch(withFrom(withZoom(search, next), start)),
    frozen: {
      get: () => moveStore.get()?.state.source === 'pointer',
      subscribe: (listener) => moveStore.subscribe(listener),
    },
  });
  const zoom = buffer.zoom;
  const zoomNow = { band: zoom, pxPerHour: buffer.pxPerHour };
  // The zoom as the URL holds it, which the links to the other pages carry; the default stays out.
  const urlZoomNow = withZoom<BoardSearch>({}, buffer.pxPerHour).zoom;
  const linkZoom: Readonly<Record<string, string>> =
    urlZoomNow === undefined ? {} : { zoom: String(urlZoomNow) };
  const range = buffer.range;
  // The visible start, which the URL holds once scrolling stops and links to the other pages carry.
  const from = search.from ?? plantDateOf(frame?.nowMs ?? Date.now(), timeZone);

  // The view keeps the chunks that hold the selected order's job orders and the one in Details.
  // The view keeps the chunks of the selected order's job orders, of the one in Details and of the
  // focused block (ADR 0089).
  const keep = useMemo(() => {
    const ids = new Set<string>(detailFor === undefined ? [] : [detailFor]);
    if (focused !== undefined) ids.add(focused);
    for (const order of rowList.orders) {
      if (order.id === search.order) for (const row of order.jobOrders) ids.add(row.id);
    }
    return ids;
  }, [detailFor, focused, rowList.orders, search.order]);
  const chunks = useTimeChunks({
    load: loadChunk,
    zoom,
    timeZone,
    // The chunks are aligned to the plant's dates, which the first page of the row list brings.
    buffer: frame === undefined ? undefined : range,
    view: buffer.settled,
    keep,
    paused: buffer.zooming,
  });
  // The chunks of the buffer without their job orders, which the bands and the status line show.
  const unloaded = unloadedChunks(chunks.chunks, range);
  // The bands also cover the time a zoom gesture shows before its chunks are requested.
  const banded = chunks.pending.length === 0 ? unloaded : [...unloaded, ...chunks.pending];
  // The board is busy while a chunk of its buffer or a page of its row list loads: the job orders
  // of an order on a page still to come draw once it is in.
  const chunksLoading =
    unloaded.some((chunk) => chunk.status === 'loading') || rowList.next === 'loading';
  // A machine without blocks says why while a chunk of the buffer has no job orders.
  const emptyText = chunksLoading
    ? 'Loading job orders'
    : unloaded.some((chunk) => chunk.status === 'refused')
      ? 'Too many job orders to show'
      : unloaded.some((chunk) => chunk.status === 'failed')
        ? 'Job orders not loaded'
        : query !== ''
          ? 'No job orders of the filtered orders in this range'
          : 'No jobs in this range';
  const committed = useMemo(
    () =>
      frame === undefined || range === undefined
        ? undefined
        : loadedSnapshot(frame, rowList.orders, chunks.jobOrders, range),
    [frame, rowList.orders, chunks.jobOrders, range],
  );

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
  const fullModel = useMemo(
    () =>
      snapshot === undefined || range === undefined ? undefined : boardModelOf(snapshot, range),
    [snapshot, range],
  );
  // What the board draws: with a filter, only the job orders of the matching orders, by number at
  // once, so a stale chunk never shows the others (ADR 0090).
  const model = useMemo(() => {
    if (fullModel === undefined || query === '') return fullModel;
    const matching = (row: JobOrderRow) => matchesOrderFilter(row.order.number, query);
    return {
      groups: fullModel.groups.map((group) => ({
        ...group,
        machines: group.machines.map((machine) => ({
          ...machine,
          blocks: machine.blocks.filter(matching),
        })),
      })),
      notPlaced: fullModel.notPlaced.filter(matching),
    };
  }, [fullModel, query]);
  // No match is the row list's answer, not the drawn time, which may hold none of a match's job
  // orders.
  const noMatch =
    query !== '' &&
    matchList.status === 'ready' &&
    matchList.next === 'done' &&
    matchList.orders.length === 0;
  const scale = buffer.scale;
  const timeWidth = Math.ceil(scale?.widthPx ?? 0);
  // The zoom buttons over the time area: a gesture over them zooms the timeline too.
  const zoomOverlay = useRef<HTMLFieldSetElement | null>(null);
  const timelineZoom = useTimelineZoom({
    buffer,
    grid: gridElement,
    panels: [zoomOverlay],
    plant: zoomPlant,
    dragging: () => moveStore.get()?.state.source === 'pointer',
  });
  // The field writes after its pause, so it updates the URL as it then is, not as it was at the
  // key: a selection made in the pause stays.
  const setQuery = (next: string) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) =>
        withQuery(boardSearch(previous), next) as Record<string, unknown>,
      replace: true,
    });
  const clearFilter = () => {
    setQuery('');
    filterInput.current?.focus();
  };
  // A q longer than 100 characters is dropped with the polite status message (ADR 0062, 0090).
  const droppedQuery = rawSearch.q !== undefined && rawSearch.q !== '' && search.q === undefined;
  useEffect(() => {
    if (!droppedQuery) return;
    void setSearch(search);
    announce(droppedKeyMessage);
  }, [droppedQuery, search, setSearch]);
  // The time area scrolls to the span of the filter's first match, from the row list, which knows
  // it also when its job orders lie outside the loaded time, only when that first match changes,
  // not on every key (ADR 0090). A link that opens filtered at a start keeps it until the filter
  // changes; a move in progress puts the scroll off.
  const firstMatchStart = useMemo(() => {
    if (query === '') return undefined;
    const listed = matchList.orders.find(
      (order) => order.span !== undefined && matchesOrderFilter(order.number, query),
    );
    return listed?.span === undefined ? undefined : { id: listed.id, ms: listed.span.fromMs };
  }, [query, matchList.orders]);
  const linkedQuery = useRef(search.from === undefined ? undefined : search.q);
  const scrolledToMatch = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (query === '') {
      scrolledToMatch.current = undefined;
      linkedQuery.current = undefined;
      return;
    }
    if (firstMatchStart === undefined || firstMatchStart.id === scrolledToMatch.current) return;
    if (moveStore.get() !== undefined) return;
    scrolledToMatch.current = firstMatchStart.id;
    if (query === linkedQuery.current) return;
    linkedQuery.current = undefined;
    timelineZoom.stop();
    buffer.goTo(zoomNow, { ms: firstMatchStart.ms, viewportX: machineWidth });
  });
  // The filter's result is said politely once the matching orders are in (WCAG 4.1.3).
  const matchesKnown = query !== '' && matchList.status === 'ready' && matchList.next === 'done';
  const matchCount = matchList.orders.length;
  useEffect(() => {
    if (!matchesKnown) return;
    announce(
      matchCount === 0
        ? `No orders match ${query}`
        : `${matchCount} ${matchCount === 1 ? 'order matches' : 'orders match'} ${query}`,
    );
  }, [matchesKnown, matchCount, query]);
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
    // The order's first operation in the range: by operation sequence, then by setup start. Its
    // block draws once its time chunk has loaded, so the link waits for the chunks loading.
    const first = allRows
      .filter((row) => row.order.id === search.order)
      .sort(
        (a, b) =>
          a.operation.sequence - b.operation.sequence ||
          (a.jobOrder.placement?.setupStartMs ?? Number.MAX_SAFE_INTEGER) -
            (b.jobOrder.placement?.setupStartMs ?? Number.MAX_SAFE_INTEGER),
      )[0];
    if (
      first === undefined &&
      (chunksLoading || chunks.chunks.length === 0 || rowList.next !== 'done')
    ) {
      return;
    }
    openedFromLink.current = true;
    if (first === undefined) return;
    detailReturn.current = first.jobOrder.id;
    setDetailFor(first.jobOrder.id);
  }, [model, allRows, search.order, chunksLoading, chunks.chunks.length, rowList.next]);

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
  // Alt+Page Up or Alt+Page Down moved the view in time from a focus target: focus moves on once
  // the new buffer's lines are drawn, which hold the job orders of the new view.
  const [pendingPage, setPendingPage] = useState<
    { readonly from: string; readonly view: TimeRange } | undefined
  >(undefined);
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
  const notAllowed = useNotAllowed(moveStore, snapshot);

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
    const state = { jobOrderId, setupStartMs, equipment, source: 'keyboard' } as const;
    const preview = previewOf(snapshot, state, true);
    if (preview === undefined) return;
    // A start before now is refused with PAST in the preview, as the cascade knows no now, and an
    // overdue row left where it was writes nothing (ADR 0089).
    if (preview.refused !== undefined) {
      announce(refusalMessage(preview.displayNumber, preview.refused));
      return;
    }
    if (staysOverdue(snapshot, state)) return;
    const { draft: next, result } = moveInDraft(
      committed,
      draft,
      { jobOrderId, setupStartMs, equipment },
      { cascade: true },
    );
    if (result.refused !== undefined) {
      announce(refusalMessage(preview.displayNumber, result.refused));
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
  /**
   * Moves focus to a target of the grid; false when it is not drawn. A move in time has already put
   * the view where it goes, so its target takes focus without scrolling.
   */
  function focusTarget(key: string, scroll = true): boolean {
    const element = document.querySelector<HTMLElement>(`[data-board-focus="${CSS.escape(key)}"]`);
    if (element === null) return false;
    setFocused(key);
    element.focus({ preventScroll: true });
    if (!scroll) return true;
    const grid = element.closest<HTMLElement>('[role="grid"]');
    const kept = { left: grid?.scrollLeft ?? 0, top: grid?.scrollTop ?? 0 };
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (grid === null) return true;
    if (element.closest('[data-sticky-column]') !== null) grid.scrollLeft = kept.left;
    if (element.closest('[data-pinned-row]') !== null) grid.scrollTop = kept.top;
    return true;
  }
  useEffect(() => {
    if (pendingPage === undefined) return;
    const next = boardFocusInView(lines, pendingPage.from, pendingPage.view);
    // Drawn now, or nothing left to focus: the grid went, or the target with it.
    if (next === undefined || focusTarget(next, false)) setPendingPage(undefined);
  });
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
    timelineZoom.stop();
    buffer.goTo(zoomNow, { ms: start, viewportX: machineWidth + (width - machineWidth) / 2 });
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = (event.target as HTMLElement).getAttribute('data-board-focus');
    if (key === null) return;
    // Minus and plus zoom by a factor of 2 at the focused block (ADR 0090); plus may need Shift.
    if (timelineZoom.onKeyDown(event)) {
      event.preventDefault();
      return;
    }
    // Alt+Page Up and Alt+Page Down move in time, one viewport width (ADR 0090); focus goes to
    // the line's first job order in the new view, else its row header, once it is drawn.
    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === 'PageDown' || event.key === 'PageUp')
    ) {
      event.preventDefault();
      timelineZoom.stop();
      const view = buffer.page(event.key === 'PageDown' ? 'later' : 'earlier');
      if (view !== undefined) setPendingPage({ from: key, view });
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
  // The mock source's refusal, or the API's FORBIDDEN of a server source.
  const isRefusal = (error: unknown) =>
    error instanceof PlanningForbidden || classifyError(error).page === 'forbidden';
  // A refusal shows no access, of the rows or of a time chunk the board loads later.
  const forbidden =
    (loadError !== undefined && isRefusal(loadError)) ||
    chunks.chunks.some((chunk) => chunk.status === 'failed' && isRefusal(chunk.error));
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
  } else if (rowList.status === 'refused') {
    state = {
      status: 'error',
      title: 'Too many orders for the board',
      // The board needs every open order for its move rules, so the order filter cannot narrow it.
      description: `More than ${ganttMaxOrders.toLocaleString('en-GB')} orders are open at this plant, more than the board shows at once.`,
      error: rowList.error,
      onRetry: () =>
        new Promise<void>((resolve) => {
          retryDone.current = resolve;
          rowList.retry();
        }),
    };
  } else if (loadError !== undefined) {
    // A failed load shows the error, also when the range before is still in memory: its rows
    // would read as a range without job orders.
    state = {
      status: 'error',
      title: 'The board could not be loaded',
      description:
        'Your draft and the saved plan are not affected. Try again, or open the job table.',
      error: loadError,
      onRetry: () =>
        new Promise<void>((resolve) => {
          retryDone.current = resolve;
          rowList.retry();
        }),
      // The job table has no range (ADR 0091); it takes the board's order filter as its search.
      action: (
        <Link
          to={
            planningLinks.jobOrders({ plant }, search.q === undefined ? {} : { q: search.q }).href
          }
          className={buttonVariants({ variant: 'outline' })}
        >
          Open the job table
        </Link>
      ),
    };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (query !== '' && (matchList.status === 'failed' || matchList.status === 'refused')) {
    state = {
      status: 'error',
      title: 'The matching orders could not be loaded',
      error: matchList.error,
      onRetry: async () => matchList.retry(),
    };
  } else if (noMachines) {
    state = {
      status: 'empty',
      icon: Drill,
      title: 'No machines to plan at this plant yet',
      description:
        'The board shows the machines marked as plannable. A plant admin adds machines in Machines and marks them there.',
      action: (
        <Link
          to={coreLinks.settings.machines({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Open Machines
        </Link>
      ),
    };
  } else if (noMatch) {
    // The filter matches no order: the empty state names it, and Clear filter brings every order
    // back (ADR 0090).
    state = {
      status: 'empty',
      title: `No orders match ${query}`,
      description: 'No open production order has this text in its number.',
      action: (
        <Button variant="outline" onClick={clearFilter}>
          Clear filter
        </Button>
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

  const erpNote =
    snapshot?.erp === undefined || noMachines ? undefined : (
      <span className="text-sm text-muted-foreground">
        ERP data as of {plantTime(snapshot, snapshot.erp.importedAtMs)}
      </span>
    );
  // The chunks' status shows with the drawn board, not on its empty or error states.
  const chunksShown = gridShown && state.status === 'ready';
  const fixtureNote =
    snapshot?.fixture === undefined ? undefined : (
      <p className="text-xs text-muted-foreground">Showing fixture {snapshot.fixture}.</p>
    );

  return (
    <PageFrame
      title="Planning board"
      // The title row holds the ERP time and one status line, the fixture's note while there is
      // one and the chunks while the board is drawn, so the grid starts right under the bar
      // (ADR 0090).
      meta={
        erpNote === undefined && fixtureNote === undefined && !chunksShown ? undefined : (
          <>
            {erpNote}
            {chunksShown ? (
              <ChunkStatus
                chunks={unloaded}
                timeZone={timeZone}
                onRetry={chunks.retry}
                leading={fixtureNote}
              />
            ) : (
              fixtureNote
            )}
          </>
        )
      }
      state={state}
      toolbarBesideTitle
      toolbar={
        forbidden || noMachines ? undefined : (
          <div role="toolbar" aria-label="Board" className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-8 px-3"
              onClick={() => timelineZoom.goTo(snapshot?.nowMs ?? Date.now())}
            >
              Go to now
            </Button>
            <OrderFilterField value={query} onChange={setQuery} inputRef={filterInput} />
            <span className="grow" />
            {gridShown && draftChangeCount(draft) > 0 && (
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
                {`My draft, ${changesText(draftChangeCount(draft))}`}
              </Button>
            )}
          </div>
        )
      }
    >
      {gridShown && rowList.next === 'failed' && (
        <RowsStatus
          loaded={rowList.orders.length}
          total={rowList.totalCount}
          onRetry={rowList.retry}
        />
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
            <div ref={fillRef} className="relative flex min-w-0 flex-col">
              <BoardGrid
                name={gridName}
                snapshot={snapshot}
                model={model}
                cellsOf={(code) => cells.get(code) ?? []}
                scale={scale}
                machineWidth={machineWidth}
                machineBounds={machineBounds}
                onMachineWidthChange={(next, done) => {
                  if (next !== undefined && !done) {
                    setDraggedMachineWidth(next);
                    return;
                  }
                  setDraggedMachineWidth(undefined);
                  if (next !== undefined) keepMachineWidth(next);
                }}
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
                {...(notAllowed !== undefined && { notAllowed })}
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
                busy={chunksLoading}
                bands={
                  <ChunkBands
                    chunks={banded}
                    scale={scale}
                    labelTop={`${timeHeaderHeightRem + boardRowRem.notPlaced}rem`}
                  />
                }
                emptyText={emptyText}
                onScroll={buffer.onScroll}
              />
              <ZoomOverlay
                zoom={zoomNow}
                onZoomStep={timelineZoom.step}
                onZoomToFit={() => {
                  const target = boardFitTargetOf(snapshot, search.order);
                  timelineZoom.fit(target.span, target.name);
                }}
                ref={zoomOverlay}
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
                  href: planningLinks.gantt(
                    { plant },
                    { ...linkZoom, from, order: orderId, chain: '1' },
                  ).href,
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
              // With no changes left, My draft has left the bar, so focus goes to the order filter.
              finalFocus={() =>
                draftChangeCount(draft) === 0 ? filterInput.current : (draftOpener.current ?? null)
              }
            />
          </GanttViewProvider>
        )}
    </PageFrame>
  );
}
