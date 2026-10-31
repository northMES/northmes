// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useShell } from '@northmes/web-sdk';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ExpandedState } from '@tanstack/react-table';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { useBoardFields } from '../../board-fields-store.ts';
import { ChunkBands, ChunkStatus, unloadedChunks } from '../../components/chunk-status/index.ts';
import { ZoomOverlay, zoomOverlayReserve } from '../../components/range-controls/index.ts';
import {
  type GanttCalendar,
  type GanttDataSource,
  type GanttPageRequest,
  type GanttSnapshot,
  ganttMaxOrders,
} from '../../gantt-data.ts';
import {
  applyDraft,
  cascadeFromHere,
  combineInDraft,
  type DraftConflict,
  discardChange,
  draftChangeCount,
  draftConflicts,
  draftRowIds,
  emptyDraft,
  moveBack,
  orderNumbersText,
  runPreview,
  runSummary,
  splitRunInDraft,
} from '../../gantt-draft.ts';
import { loadedSnapshot } from '../../gantt-loaded.ts';
import {
  defaultZoom,
  droppedKeyMessage,
  type GanttSearch,
  ganttSearch,
  matchesOrderFilter,
  withChain,
  withFrom,
  withOrder,
  withQuery,
  withZoom,
} from '../../gantt-search.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import { inventoryOf } from '../../inventory-of.ts';
import {
  type MaterialShortage,
  materialShortages as materialShortageList,
} from '../../material-projection.ts';
import { usePlanningDraft } from '../../planning-draft.tsx';
import { closedWindows } from '../../timeline/availability-shading.ts';
import { type ClosedWindow, spanLabel, type TimeRange } from '../../timeline/time-scale.ts';
import { useTimeBuffer } from '../../timeline/use-time-buffer.ts';
import { useTimeChunks } from '../../timeline/use-time-chunks.ts';
import { useTimelineZoom } from '../../timeline/use-timeline-zoom.ts';
import type { ZoomPlant } from '../../timeline/zoom-view.ts';
import { useGanttRows } from '../../use-gantt-rows.ts';
import { remPx, useMeasuredWidth, useViewportFill } from '../../use-grid-size.ts';
import { useMoveActions } from '../../use-move-actions.ts';
import { chainOf } from './gantt-chain.ts';
import { type GanttRunActions, type GanttViewContext, GanttViewProvider } from './gantt-context.ts';
import { GanttDetailDrawer } from './gantt-detail-panel.tsx';
import { GanttDraftDrawer } from './gantt-draft-drawer.tsx';
import { GanttLinks, linksOf } from './gantt-links.tsx';
import { GanttMarkerLayer, overlayMarkers } from './gantt-marker-layer.tsx';
import { GanttMoreRows } from './gantt-more-rows.tsx';
import { refusalMessage } from './gantt-move.ts';
import { GanttNotPlacedRow, notPlacedHeightRem } from './gantt-not-placed-row.tsx';
import { useGanttOptions } from './gantt-options.ts';
import { GanttRowView } from './gantt-row.tsx';
import {
  buildGanttRows,
  fitTargetOf,
  type GanttRow,
  type JobOrderRow,
  notPlacedRows,
  rowHeightRem,
  selectionRowOf,
} from './gantt-rows.ts';
import { GanttRunDialog } from './gantt-run-dialog.tsx';
import { GanttSplitter } from './gantt-splitter.tsx';
import { GanttTimeHeader, timeHeaderHeightRem } from './gantt-time-area.tsx';
import { GanttToolbar } from './gantt-toolbar.tsx';
import {
  type GanttSort,
  type GanttTableRow,
  GanttTreeHeaderCells,
  treePaneLayout,
  useGanttTable,
  visibleColumns,
} from './gantt-tree-pane.tsx';
import { useTreePaneScroll } from './gantt-tree-scroll.ts';
import { GanttWorkloadPanel } from './gantt-workload-panel.tsx';

export interface GanttScreenProps {
  /** Where the Gantt reads from; the fixture G1 until the GraphQL source exists (plan 18). */
  readonly source?: GanttDataSource;
}

/**
 * "Material short: 1004.10. No longer material short: 1005.20.", or nothing when no warning
 * changed.
 */
function shortageChangeText(
  added: readonly string[],
  cleared: readonly string[],
): string | undefined {
  const parts = [
    ...(added.length > 0 ? [`Material short: ${added.join(', ')}.`] : []),
    ...(cleared.length > 0 ? [`No longer material short: ${cleared.join(', ')}.`] : []),
  ];
  return parts.length === 0 ? undefined : parts.join(' ');
}

/**
 * The plant calendar, kept while a load answers the same one, so a load of the buffer never
 * changes the closed time Hide closed time compresses and rebuilds the buffer again.
 */
function useStableCalendar(calendar: GanttCalendar | undefined): GanttCalendar | undefined {
  // Each loaded calendar is compared once, when it arrives, as React's rule for state derived
  // from props says.
  const [kept, setKept] = useState({ seen: calendar, calendar });
  if (calendar === kept.seen) return kept.calendar;
  const same = JSON.stringify(calendar) === JSON.stringify(kept.calendar);
  const next = { seen: calendar, calendar: same ? kept.calendar : calendar };
  setKept(next);
  return next.calendar;
}

/**
 * The order Gantt (plan 18, The order Gantt), the board route's view=gantt: the tree of orders,
 * operations and job orders on the left, the time area on the right, both inside one treegrid, the
 * pinned Not placed row under the time header, and the toolbar of D5. The URL holds the view, the
 * zoom, the range start and the selected order; the options stay local. The screen reads one data
 * source and never knows which; phase 1 reads the fixture G1 and says so.
 */
export function GanttScreen({ source: given }: GanttScreenProps) {
  const fromContext = useGanttSource();
  const source = given ?? fromContext;
  const { plant } = useShell();
  // The router keeps its search object while the URL stays, so the parsed keys keep their identity
  // and the callbacks below that read them stay stable across renders.
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => ganttSearch(rawSearch), [rawSearch]);
  const navigate = useNavigate();
  const setSearch = useCallback(
    (next: GanttSearch) =>
      navigate({ to: '.', search: next as Record<string, unknown>, replace: true }),
    [navigate],
  );
  // The planner's draft, in memory until the plan server exists, and the move in progress.
  const [draft, setDraft] = usePlanningDraft();
  const [draftOpen, setDraftOpen] = useState(false);
  // The orders Shift+click or Shift+Space added to the selection, after the one the URL names
  // (plan 18, Runs); a plain selection clears them.
  const [extraSelected, setExtraSelected] = useState<readonly string[]>([]);
  // The review step of a run: the orders it combines, while it is open.
  const [runReview, setRunReview] = useState<readonly string[] | undefined>(undefined);
  /** The element that opened the My draft drawer, which takes focus back when it closes. */
  const draftOpener = useRef<HTMLElement | undefined>(undefined);
  const [options, setOptions] = useGanttOptions();
  // The row list by page and the job orders by time chunk (ADR 0089, Loading by time chunk), both
  // of every open order, so the move rules, the cascade and the workload see the whole plan.
  const loadRows = useCallback((page: GanttPageRequest) => source.loadRows({}, page), [source]);
  // The workload sums every order, so with the panel open every page of the row list loads.
  const rowList = useGanttRows({ load: loadRows, all: options.workload });
  // The order filter decides what is drawn (ADR 0090): its own row list loads the matching orders
  // by page, while there is a filter, and the rows drawn are those whose number matches.
  const query = search.q ?? '';
  const loadMatching = useCallback(
    (page: GanttPageRequest) => source.loadRows({ search: query }, page),
    [source, query],
  );
  const matchList = useGanttRows({ load: loadMatching, enabled: query !== '' });
  const drawnList = query === '' ? rowList : matchList;
  const loadedOrders = useMemo(() => {
    if (query === '') return rowList.orders;
    const ids = new Set(rowList.orders.map((order) => order.id));
    return [...rowList.orders, ...matchList.orders.filter((order) => !ids.has(order.id))];
  }, [query, rowList.orders, matchList.orders]);
  const frame = rowList.frame;
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [sort, setSort] = useState<GanttSort | undefined>(undefined);
  const [focusedRowId, setFocusedRowId] = useState<string | undefined>(undefined);
  // The row the docked panel shows, opened by a double click or by Enter, and whether the panel is open.
  const [detailRowId, setDetailRowId] = useState<string | undefined>(undefined);
  /** The row that takes focus when the drawer closes: the opened row, or the row a chain link named. */
  const returnRowId = useRef<string | undefined>(undefined);
  const [width, gridRef] = useMeasuredWidth();
  const urlZoom = search.zoom ?? defaultZoom;
  const [fillHeight, fillRef] = useViewportFill(
    `${urlZoom}|${search.from ?? ''}|${options.hideClosed}|${options.workload}`,
  );

  const timeZone = frame?.plant.timeZone ?? 'UTC';
  const productionDayStart = frame?.plant.productionDayStart ?? '06:00';
  // A column's width while its header edge is dragged, kept in the options on release (#943).
  const [draggedWidth, setDraggedWidth] = useState<{ id: string; width: number } | undefined>(
    undefined,
  );
  const columnWidths = useMemo(
    () =>
      draggedWidth === undefined
        ? options.columnWidths
        : { ...options.columnWidths, [draggedWidth.id]: draggedWidth.width },
    [options.columnWidths, draggedWidth],
  );
  const columns = useMemo(
    () => visibleColumns(options.hiddenColumns, columnWidths),
    [options.hiddenColumns, columnWidths],
  );
  const changeColumnWidth = (id: string, width: number | undefined, done: boolean) => {
    if (width !== undefined && !done) {
      setDraggedWidth({ id, width });
      return;
    }
    setDraggedWidth(undefined);
    if (width !== undefined) setOptions({ columnWidths: { ...options.columnWidths, [id]: width } });
  };
  // The tree pane sticks as one block at the share of the view its splitter sets, 40 percent by
  // default; columns wider than the pane scroll inside it, so the time area stays reachable on a
  // narrow grid (WCAG 1.4.10) and the time column always starts where the pane ends (#943).
  const pane = useMemo(
    () => treePaneLayout(columns, width, options.treePaneShare),
    [columns, width, options.treePaneShare],
  );
  // The pane scrolls sideways while its columns are wider than it shows.
  const paneScrolls = pane.contentWidth > pane.innerWidth;
  const paneWidth = pane.paneWidth;
  const treeScroll = useTreePaneScroll({
    innerWidth: pane.innerWidth,
    contentWidth: pane.contentWidth,
  });
  const gridId = useId();

  const gridElement = useRef<HTMLElement | null>(null);
  // One ref for the grid, kept across renders, so the width is not measured again on each one.
  const { gridRef: treeScrollRef } = treeScroll;
  const ganttGridRef = useCallback(
    (node: HTMLDivElement | null) => {
      gridElement.current = node;
      gridRef(node);
      treeScrollRef(node);
    },
    [gridRef, treeScrollRef],
  );
  // Hide closed time compresses the plant calendar's closed windows; the calendar is kept while a
  // load answers the same one, so a load never rebuilds the buffer.
  const calendar = useStableCalendar(frame?.calendar);
  const zoomPlant = useMemo<ZoomPlant>(
    () => ({
      timeZone,
      productionDayStart,
      ...(options.hideClosed &&
        calendar !== undefined && {
          closedOf: (around: TimeRange) => closedWindows(calendar, timeZone, around),
        }),
    }),
    [timeZone, productionDayStart, options.hideClosed, calendar],
  );
  // The endless axis (ADR 0089): a buffer of three viewport widths that moves near an edge. A
  // pointer drag holds it, since the drag reads its moves in this buffer's pixels (#899).
  const buffer = useTimeBuffer({
    zoom: urlZoom,
    from: search.from,
    nowMs: frame?.nowMs ?? Date.now(),
    widthPx: width,
    grid: gridElement,
    columns: { treeWidth: paneWidth, stickyWidth: paneWidth },
    plant: zoomPlant,
    // The zoom goes to the URL with the start, and the default zoom stays out of it.
    onNavigate: (next, start) => void setSearch(withFrom(withZoom(search, next), start)),
    frozen: {
      get: () => moveStore.get()?.state.source === 'pointer',
      subscribe: (listener) => moveStore.subscribe(listener),
    },
  });
  const zoom = buffer.zoom;
  const range = buffer.range;
  // The view keeps the chunks that hold the job orders of the selected orders, of the row in
  // Details and of the focused row, wherever the buffer moves (ADR 0089).
  const keep = useMemo(() => {
    const orderIds = new Set(search.order === undefined ? [] : [search.order, ...extraSelected]);
    const ids = new Set<string>(
      [detailRowId, focusedRowId].filter((id): id is string => id !== undefined),
    );
    for (const order of loadedOrders) {
      if (orderIds.has(order.id)) for (const row of order.jobOrders) ids.add(row.id);
    }
    return ids;
  }, [search.order, extraSelected, detailRowId, focusedRowId, loadedOrders]);
  const loadChunk = useCallback(
    (from: string, to: string) => source.loadChunk(from, to, {}),
    [source],
  );
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
  // The plan of the loaded rows and chunks, analysed over the buffer.
  const committed = useMemo(
    () =>
      frame === undefined || range === undefined
        ? undefined
        : loadedSnapshot(frame, loadedOrders, chunks.jobOrders, range),
    [frame, loadedOrders, chunks.jobOrders, range],
  );
  // Everything the view draws reads the plan with the draft applied, analysed over the buffer
  // (plan 18, Resolving a break in the draft).
  const snapshot = useMemo(
    () =>
      committed === undefined || range === undefined
        ? undefined
        : applyDraft(committed, draft, range),
    [committed, draft, range],
  );

  // The order filter's field, where focus goes when My draft leaves the bar or the filter clears.
  const filterInput = useRef<HTMLInputElement | null>(null);
  const setQuery = (next: string) => void setSearch(withQuery(search, next));
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

  // chain without order is dropped with the polite status message (ADR 0062, plan 18).
  const droppedChain = search.chain !== undefined && search.order === undefined;
  useEffect(() => {
    if (!droppedChain) return;
    const { chain: _, ...rest } = search;
    void setSearch(rest);
    announce(droppedKeyMessage);
  }, [droppedChain, search, setSearch]);

  const allRows = useMemo(
    () => (snapshot === undefined ? [] : buildGanttRows(snapshot)),
    [snapshot],
  );
  // The rows of the orders the filter matches, by their number at once, so the rows of other
  // orders go before the filtered page answers.
  const rows = useMemo(
    () =>
      query === ''
        ? allRows
        : allRows.filter((row) =>
            (row.kind === 'run' ? row.orders : [row.order]).some((order) =>
              matchesOrderFilter(order.number, query),
            ),
          ),
    [allRows, query],
  );

  const plantClosed = useMemo(
    () =>
      snapshot === undefined || range === undefined
        ? []
        : closedWindows(snapshot.calendar, timeZone, range),
    [snapshot, timeZone, range],
  );
  const closedByCalendar = useMemo(() => {
    const byName = new Map<string, readonly ClosedWindow[]>();
    if (snapshot !== undefined) byName.set(snapshot.calendar.name, plantClosed);
    return byName;
  }, [snapshot, plantClosed]);
  // The time area is the buffer at its natural width, and scrolls sideways inside the grid under
  // the sticky tree pane.
  const scale = buffer.scale;
  const timeWidth = Math.ceil(scale?.widthPx ?? 0);
  const gridTemplateColumns = `${paneWidth}px ${timeWidth}px`;
  // The workload lanes keep the time area's scroll position, also after a buffer move, which
  // corrects the grid's position in a layout effect before this one runs; a gesture over them
  // zooms the timeline (ADR 0090).
  const workloadLanes = useRef<HTMLDivElement | null>(null);
  // The zoom buttons over the time area: a gesture over them zooms the timeline too.
  const zoomOverlay = useRef<HTMLFieldSetElement | null>(null);
  const timelineZoom = useTimelineZoom({
    buffer,
    grid: gridElement,
    panels: [workloadLanes, zoomOverlay],
    plant: zoomPlant,
    dragging: () => moveStore.get()?.state.source === 'pointer',
  });
  // The time area scrolls to the span of the filter's first match that has one, only when that
  // first match changes, not on every key (ADR 0090). A link that opens filtered keeps its start.
  const firstMatch =
    query === '' ? undefined : rows.find((row) => fitTargetOf(row, rows).span !== undefined);
  const scrolledToMatch = useRef<string | null | undefined>(
    search.q === undefined ? undefined : null,
  );
  useEffect(() => {
    if (query === '') {
      scrolledToMatch.current = undefined;
      return;
    }
    if (firstMatch === undefined || firstMatch.id === scrolledToMatch.current) return;
    const linked = scrolledToMatch.current === null;
    scrolledToMatch.current = firstMatch.id;
    const span = fitTargetOf(firstMatch, rows).span;
    if (linked || span === undefined || moveStore.get() !== undefined) return;
    timelineZoom.stop();
    buffer.goTo(
      { band: zoom, pxPerHour: buffer.pxPerHour },
      { ms: span.fromMs, viewportX: paneWidth },
    );
  });

  const followGrid = useCallback(() => {
    const lanes = workloadLanes.current;
    const left = gridElement.current?.scrollLeft;
    if (lanes !== null && left !== undefined && lanes.scrollLeft !== left) lanes.scrollLeft = left;
  }, []);
  const workloadRef = useCallback(
    (node: HTMLDivElement | null) => {
      workloadLanes.current = node;
      followGrid();
    },
    [followGrid],
  );
  useLayoutEffect(followGrid);

  const table = useGanttTable({
    rows,
    sort,
    hiddenColumns: options.hiddenColumns,
    expanded,
    onExpandedChange: setExpanded,
  });
  const flatRows = table.getRowModel().rows;
  const unplaced = useMemo(() => notPlacedRows(rows), [rows]);
  // The vertical centre of each visible job order row's block, for the links, from the row heights.
  const rem = remPx();
  const linkRows: { row: JobOrderRow; centerY: number }[] = [];
  let totalHeight = 0;
  for (const row of flatRows) {
    const heightPx = rowHeightRem[row.original.kind] * rem;
    if (row.original.kind === 'jobOrder') {
      linkRows.push({ row: row.original, centerY: totalHeight + heightPx / 2 });
    }
    totalHeight += heightPx;
  }
  // The critical chain of the selected order while chain=1 (plan 18, Float and the critical chain).
  const chain = useMemo(
    () =>
      snapshot !== undefined && search.chain !== undefined && search.order !== undefined
        ? chainOf(snapshot, search.order)
        : undefined,
    [snapshot, search.chain, search.order],
  );
  const chainRowIds = useMemo(() => chain?.rowIds ?? new Set<string>(), [chain]);
  // The chain highlight is announced when it appears, and "Chain hidden" when it ends.
  const spokenChain = useRef<string | undefined>(undefined);
  useEffect(() => {
    const announcement = chain?.announcement;
    if (announcement === spokenChain.current) return;
    if (announcement !== undefined) announce(announcement);
    else if (spokenChain.current !== undefined) announce('Chain hidden');
    spokenChain.current = announcement;
  }, [chain]);
  // A chain that appears with no Details open, as from ?order=<id>&chain=1 in a link, opens the
  // order's Details with the explanation; a chain shown from a row's Details keeps that row.
  const openedChainFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    const orderId = chain?.order.id;
    if (orderId === openedChainFor.current) return;
    openedChainFor.current = orderId;
    if (orderId !== undefined) setDetailRowId((current) => current ?? orderId);
  }, [chain]);
  const conflicts = useMemo(
    () => (snapshot === undefined ? [] : draftConflicts(snapshot, draft)),
    [snapshot, draft],
  );
  const draftIds = useMemo(() => draftRowIds(draft), [draft]);
  // A block takes focus and scrolls into view past the sticky tree pane, the time header and the
  // Not placed row, which the grid's scroll padding keeps it clear of (WCAG 2.4.11).
  const focusBlock = (jobOrderId: string) => {
    const block = document.querySelector<HTMLElement>(`[data-block="${jobOrderId}"]`);
    block?.focus({ preventScroll: true });
    block?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const { actions: moveActions, store: moveStore } = useMoveActions({
    committed,
    snapshot,
    draft,
    setDraft,
    cascadeOn: options.cascade,
    zoom,
    timeZone,
    focusBlock,
  });
  const rowById = useMemo(() => {
    const map = new Map<string, GanttRow>();
    const addOrder = (order: GanttRow) => {
      map.set(order.id, order);
      if (order.kind !== 'order') return;
      for (const operation of order.subRows) {
        map.set(operation.id, operation);
        for (const jobOrder of operation.subRows) map.set(jobOrder.id, jobOrder);
      }
    };
    for (const row of rows) {
      map.set(row.id, row);
      if (row.kind === 'run') for (const order of row.subRows) addOrder(order);
      else addOrder(row);
    }
    return map;
  }, [rows]);
  const detailRow = detailRowId === undefined ? undefined : rowById.get(detailRowId);
  // A reload that drops the opened row closes the drawer and forgets the row, so the sheet's
  // final focus falls back to its own default instead of a row that is gone.
  useEffect(() => {
    if (snapshot === undefined || detailRowId === undefined || rowById.has(detailRowId)) return;
    returnRowId.current = undefined;
    setDetailRowId(undefined);
  }, [snapshot, detailRowId, rowById]);

  // Show critical chain on an order selects it and turns the chain on; on the shown order it ends.
  const toggleChain = useCallback(
    (orderId: string) => {
      if (chain?.order.id === orderId) void setSearch(withChain(search, false));
      else void setSearch(withChain(withOrder(search, orderId), true));
    },
    [chain, search, setSearch],
  );
  const selectedOrderIds = useMemo(
    () => new Set(search.order === undefined ? [] : [search.order, ...extraSelected]),
    [search.order, extraSelected],
  );
  const selectOrder = (orderId: string) => {
    setExtraSelected([]);
    if (search.order !== orderId) void setSearch(withOrder(search, orderId));
  };
  /** A plain click or Enter on an order already in the selection keeps the selection (plan 18, Runs). */
  const selectUnlessSelected = (orderId: string) => {
    if (!selectedOrderIds.has(orderId)) selectOrder(orderId);
  };
  /** Shift+click or Shift+Space: the order joins the selection, or leaves it when it was in it. */
  const extendSelection = (orderId: string) => {
    if (search.order === undefined) {
      selectOrder(orderId);
      return;
    }
    if (orderId === search.order) return;
    setExtraSelected((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  };
  /** The orders a run would hold: the selection with the order the action was taken on. */
  const runCandidates = useCallback(
    (orderId: string): string[] =>
      [...selectedOrderIds, orderId].filter((id, index, all) => all.indexOf(id) === index),
    [selectedOrderIds],
  );
  const runActions = useMemo<GanttRunActions | undefined>(() => {
    if (snapshot === undefined || committed === undefined) return undefined;
    const orderOf = (id: string) => snapshot.productionOrders.find((order) => order.id === id);
    return {
      canCombine: (orderId) => {
        const candidates = runCandidates(orderId);
        // An order already in a run joins no other until that run is split (ADR 0083 rule 1).
        for (const id of candidates) {
          const run = snapshot.runs?.find((each) => each.orderIds.includes(id));
          if (run !== undefined) {
            return {
              ok: false,
              reason: `Order ${orderOf(id)?.number ?? id} is already in the run of ${run.article}; split it first`,
            };
          }
        }
        const members = candidates.map(orderOf);
        const article = orderOf(orderId)?.article ?? '';
        if (members.length < 2) return { ok: false, reason: `Select another order of ${article}` };
        if (members.some((order) => order?.article !== article)) {
          return { ok: false, reason: 'The selected orders are of different articles' };
        }
        return { ok: true };
      },
      // The review step is a modal dialog beside the Details drawer, so the drawer closes first
      // and focus comes back to its row once the dialog has closed.
      combine: (orderId) => {
        if (detailRowId !== undefined) {
          returnRowId.current = detailRowId;
          setDetailRowId(undefined);
        }
        setRunReview(runCandidates(orderId));
      },
      split: (runId) => {
        const run = draft.runs.find((each) => each.id === runId);
        setDraft(splitRunInDraft(draft, runId));
        if (detailRowId === runId) setDetailRowId(undefined);
        if (run !== undefined) {
          announce(
            `Run of ${run.article} split; ${orderNumbersText(run.orderNumbers)} are separate orders again.`,
          );
        }
      },
    };
  }, [snapshot, committed, draft, setDraft, detailRowId, runCandidates]);
  const runResult = useMemo(
    () =>
      committed === undefined || runReview === undefined
        ? undefined
        : runPreview(committed, draft, runReview),
    [committed, draft, runReview],
  );
  const combineRun = () => {
    if (committed === undefined || runReview === undefined) return;
    const { draft: next, result } = combineInDraft(committed, draft, runReview);
    setRunReview(undefined);
    if (result.run === undefined) return;
    setDraft(next);
    setExtraSelected([]);
    announce(
      `Run of ${result.run.article} in your draft: ${runSummary(next, result.run)}. Not saved.`,
    );
  };

  // The material warnings of the plan with the draft applied, so a move recomputes them before
  // Save (plan 07, Material warnings).
  const inventory = useMemo(
    () => (snapshot === undefined ? undefined : inventoryOf(snapshot)),
    [snapshot],
  );
  const { materialShortages, materialShortOrderIds } = useMemo(() => {
    const byOperation = new Map<string, MaterialShortage[]>();
    const orderIds = new Set<string>();
    for (const shortage of inventory === undefined ? [] : materialShortageList(inventory)) {
      const key = shortage.jobOrder.displayNumber;
      byOperation.set(key, [...(byOperation.get(key) ?? []), shortage]);
      orderIds.add(shortage.jobOrder.orderId);
    }
    return { materialShortages: byOperation, materialShortOrderIds: orderIds };
  }, [inventory]);
  // A draft change that makes an operation material short, or clears one, is said once after the
  // move's own message. A load, a new range or a Save sets the warnings the Gantt shows, unsaid.
  const spokenShortages = useRef<
    { committed: GanttSnapshot; draft: typeof draft; operations: readonly string[] } | undefined
  >(undefined);
  useEffect(() => {
    if (committed === undefined) return;
    const operations = [...materialShortages.keys()];
    const before = spokenShortages.current;
    spokenShortages.current = { committed, draft, operations };
    if (before === undefined || before.committed !== committed || before.draft === draft) return;
    const message = shortageChangeText(
      operations.filter((operation) => !before.operations.includes(operation)),
      before.operations.filter((operation) => !operations.includes(operation)),
    );
    if (message !== undefined) announce(message);
  }, [committed, draft, materialShortages]);
  const boardFields = useBoardFields(plant);
  const view = useMemo<GanttViewContext | undefined>(() => {
    if (snapshot === undefined || scale === undefined) return undefined;
    const equipment = new Map(snapshot.equipment.map((machine) => [machine.code, machine]));
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      snapshot,
      scale,
      closedWindows: plantClosed,
      closedWindowsOf: (code) => {
        const machine = code === undefined ? undefined : equipment.get(code);
        return closedByCalendar.get(machine?.calendar ?? '') ?? plantClosed;
      },
      timeZone,
      zoneLabel: browserZone !== timeZone,
      hideClosed: options.hideClosed,
      selectedOrderId: search.order,
      selectedOrderIds,
      chainRowIds,
      machineName: (code) =>
        code === undefined ? 'no machine' : (equipment.get(code)?.name ?? code),
      draftRowIds: draftIds,
      materialShortages,
      materialShortOrderIds,
      ...(inventory !== undefined && { inventory }),
      move: moveActions,
      runActions,
      toggleChain,
      boardFields,
    };
  }, [
    snapshot,
    inventory,
    materialShortages,
    materialShortOrderIds,
    scale,
    plantClosed,
    closedByCalendar,
    timeZone,
    options.hideClosed,
    search.order,
    selectedOrderIds,
    chainRowIds,
    draftIds,
    moveActions,
    runActions,
    toggleChain,
    boardFields,
  ]);
  const { links, limited } =
    snapshot === undefined || scale === undefined
      ? { links: [], limited: false }
      : linksOf(linkRows, snapshot, scale, search.order);

  // The next page of the row list loads once the rows end within one view of the grid's bottom,
  // as the planner scrolls down or when the rows loaded do not fill the grid.
  const { next: rowsNext, loadNext } = drawnList;
  const loadMoreRows = useCallback(
    (grid: HTMLElement | null) => {
      if (grid === null || rowsNext !== 'idle' || grid.clientHeight <= 0) return;
      if (grid.scrollTop + 2 * grid.clientHeight >= grid.scrollHeight) loadNext();
    },
    [rowsNext, loadNext],
  );
  // Also after each render, as a page that loaded or a collapsed order may leave the rows shorter
  // than the grid, with nothing to scroll.
  useEffect(() => {
    loadMoreRows(gridElement.current);
  });
  // A page of the row list loading or failing is said as a polite status message.
  useEffect(() => {
    if (rowsNext === 'loading') announce('Loading more orders.');
    else if (rowsNext === 'failed') announce('Orders could not be loaded.');
  }, [rowsNext]);

  let state: PageState = { status: 'ready' };
  if (drawnList.status === 'refused') {
    state = {
      status: 'error',
      title: 'Too many orders for the Gantt',
      description: `More than ${ganttMaxOrders.toLocaleString('en-GB')} orders match. Narrow the filter.`,
      error: drawnList.error,
      onRetry: async () => drawnList.retry(),
    };
  } else if (drawnList.status === 'failed') {
    state = {
      status: 'error',
      title: 'Could not load the Gantt',
      error: drawnList.error,
      onRetry: async () => drawnList.retry(),
    };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (query !== '') {
    // The filter matches no order: the empty state names it, and Clear filter brings every order
    // back (ADR 0090).
    if (rows.length === 0 && drawnList.status === 'ready' && drawnList.next === 'done') {
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
  } else if (rows.length === 0 && drawnList.next === 'done') {
    state = {
      status: 'empty',
      title: 'No open orders',
      description: 'Every order of this plant is finished or cancelled.',
    };
  }

  const focusRow = (rowId: string) => {
    setFocusedRowId(rowId);
    document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`)?.focus();
  };
  const focusRowAt = (index: number) => {
    const target = flatRows[Math.max(0, Math.min(flatRows.length - 1, index))];
    if (target !== undefined) focusRow(target.id);
  };
  /**
   * Alt+Page Up and Alt+Page Down from anywhere in the grid: one viewport width earlier or later
   * (ADR 0090). From a row, focus moves to the row's block when it starts in the new view, once it
   * is drawn, else to the row, the row's first cell, so it never stays on a block that culling
   * unmounts. A header keeps focus, as the move never unmounts it.
   */
  const pageInTime = (direction: 'earlier' | 'later', target: HTMLElement) => {
    timelineZoom.stop();
    const span = buffer.page(direction);
    const rowId = target.closest<HTMLElement>('[data-row-id]')?.dataset.rowId;
    const row = rowId === undefined ? undefined : flatRows.find((each) => each.id === rowId);
    if (span === undefined || row === undefined) return;
    const placement =
      row.original.kind === 'jobOrder' ? row.original.jobOrder.placement : undefined;
    const startsInView =
      placement !== undefined &&
      placement.setupStartMs >= span.fromMs &&
      placement.setupStartMs < span.toMs;
    focusRow(row.id);
    if (startsInView)
      setPendingBlock(row.original.kind === 'jobOrder' ? row.original.jobOrder.id : undefined);
  };
  // The block that takes focus once a move in time has drawn it.
  const [pendingBlock, setPendingBlock] = useState<string | undefined>(undefined);
  // It waits for the render that draws it, as when its chunk loads after the move.
  useEffect(() => {
    if (pendingBlock === undefined) return;
    const block = document.querySelector<HTMLElement>(`[data-block="${CSS.escape(pendingBlock)}"]`);
    if (block === null) return;
    block.focus({ preventScroll: true });
    setPendingBlock(undefined);
  });
  const openDetails = (row: GanttTableRow) => {
    selectUnlessSelected(row.original.order.id);
    setDetailRowId(row.id);
  };
  // The drawer closes and focus goes back to the row it opened from, or to the row a chain link
  // names: the sheet focuses it once its exit has ended, and the roving tabindex follows.
  const closeDetails = (focusRowId = detailRowId) => {
    returnRowId.current = focusRowId;
    setDetailRowId(undefined);
  };
  /** The block that takes focus when the drawer closes after a move applied from it (D3 TA12). */
  const returnBlockId = useRef<string | undefined>(undefined);
  const closeDetailsToBlock = (jobOrderId: string) => {
    returnBlockId.current = jobOrderId;
    closeDetails(jobOrderId);
  };
  const drawerFinalFocus = () => {
    const rowId = returnRowId.current ?? detailRowId;
    const blockId = returnBlockId.current;
    returnRowId.current = undefined;
    returnBlockId.current = undefined;
    if (rowId === undefined) return null;
    setFocusedRowId(rowId);
    return (
      (blockId === undefined
        ? null
        : document.querySelector<HTMLElement>(`[data-block="${blockId}"]`)) ??
      document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`)
    );
  };
  // Row focus mode (plan 18, Tree grid semantics): Up and Down move between rows, Right expands a
  // collapsed row or moves into its time cell, Left collapses an expanded row, moves from the cell
  // back to the row, or to the parent row, Home and End go to the first and last row, Page Up and
  // Page Down move ten rows, Enter opens Details. Escape ends what is on top of the stack: the
  // chain highlight, then the docked panel.
  const onRowKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    row: GanttTableRow,
    index: number,
  ) => {
    const onRow = event.target === event.currentTarget;
    const cell = event.currentTarget.querySelector<HTMLElement>('[data-cell-focus]');
    // The row keys Page Up and Page Down ignore a press with Alt, which moves in time instead and
    // which the grid takes (ADR 0090).
    if (event.altKey && (event.key === 'PageDown' || event.key === 'PageUp')) return;
    let handled = true;
    switch (event.key) {
      case 'ArrowDown':
        focusRowAt(index + 1);
        break;
      case 'ArrowUp':
        focusRowAt(index - 1);
        break;
      case 'Home':
        focusRowAt(0);
        break;
      case 'End':
        focusRowAt(flatRows.length - 1);
        break;
      case 'PageDown':
        focusRowAt(index + 10);
        break;
      case 'PageUp':
        focusRowAt(index - 10);
        break;
      case 'ArrowRight':
        if (onRow && row.getCanExpand() && !row.getIsExpanded()) row.toggleExpanded(true);
        else if (onRow) cell?.focus();
        else handled = false;
        break;
      case 'ArrowLeft':
        if (!onRow) event.currentTarget.focus();
        else if (row.getCanExpand() && row.getIsExpanded()) row.toggleExpanded(false);
        else {
          const parent = row.getParentRow();
          if (parent !== undefined) focusRow(parent.id);
        }
        break;
      // Enter on the row or on its block opens Details: the keyboard path of the double click
      // (#884, ADR 0021). The block stops Enter itself while it is in move mode.
      case 'Enter':
        if (onRow || (event.target as HTMLElement).dataset.block !== undefined) openDetails(row);
        else handled = false;
        break;
      // Space selects the row's order, Shift+Space adds it to the selection (plan 18, Runs); on a
      // run row, its orders.
      case ' ':
        if (!onRow) {
          handled = false;
          break;
        }
        if (row.original.kind === 'run') {
          const [first, ...rest] = row.original.run.orderIds;
          if (first !== undefined) {
            setExtraSelected(rest);
            if (search.order !== first) void setSearch(withOrder(search, first));
          }
        } else if (event.shiftKey) extendSelection(row.original.order.id);
        else selectOrder(row.original.order.id);
        break;
      case 'F10':
      case 'ContextMenu':
        if (event.key === 'F10' && !event.shiftKey) {
          handled = false;
          break;
        }
        event.currentTarget.querySelector<HTMLElement>('[data-row-menu]')?.click();
        break;
      case 'Escape':
        if (moveStore.get() !== undefined) moveActions?.cancel();
        else if (chain !== undefined) void setSearch(withChain(search, false));
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const gridName = [
    `${plant} order Gantt`,
    ...(buffer.settled === undefined ? [] : [spanLabel(buffer.settled, zoom, timeZone)]),
  ].join(', ');
  // The row count is unknown while pages of the row list are still to load (WAI-ARIA: -1).
  const rowCount = drawnList.next === 'done' ? flatRows.length + 2 : -1;
  // The chunks of the buffer without their job orders, which the bands and the status line show.
  const unloaded = unloadedChunks(chunks.chunks, range);
  // The bands also cover the time a zoom gesture shows before its chunks are requested.
  const banded = chunks.pending.length === 0 ? unloaded : [...unloaded, ...chunks.pending];
  const focusedId =
    focusedRowId !== undefined && flatRows.some((row) => row.id === focusedRowId)
      ? focusedRowId
      : flatRows[0]?.id;

  const notes =
    snapshot?.fixture !== undefined || limited ? (
      <p className="text-xs text-muted-foreground" data-testid="gantt-status">
        {[
          snapshot?.fixture !== undefined ? `Showing fixture ${snapshot.fixture}.` : undefined,
          limited ? 'Links shown for the selected order.' : undefined,
        ]
          .filter((part) => part !== undefined)
          .join(' ')}
      </p>
    ) : undefined;

  return (
    <PageFrame
      title="Gantt"
      state={state}
      // One status line on the title row: the fixture and link notes while they have text, and
      // the chunks while the time area is drawn, so the grid starts right under the bar (ADR 0090).
      meta={
        state.status === 'ready' &&
        view !== undefined &&
        snapshot !== undefined &&
        scale !== undefined ? (
          <ChunkStatus
            chunks={unloaded}
            timeZone={timeZone}
            onRetry={chunks.retry}
            leading={notes}
          />
        ) : (
          notes
        )
      }
      toolbarBesideTitle
      toolbar={
        <GanttToolbar
          onGoToNow={() => timelineZoom.goTo(snapshot?.nowMs ?? Date.now())}
          filter={query}
          onFilterChange={setQuery}
          filterRef={filterInput}
          options={options}
          onOptionsChange={setOptions}
          draftCount={draftChangeCount(draft)}
          onOpenDraft={() => {
            draftOpener.current = document.activeElement as HTMLElement | undefined;
            setDraftOpen(true);
          }}
        />
      }
    >
      {view !== undefined && snapshot !== undefined && scale !== undefined && (
        <GanttViewProvider value={view}>
          <div
            ref={fillRef}
            data-gantt-fill
            className="flex min-w-0 flex-col gap-3"
            style={fillHeight === undefined ? undefined : { height: `${fillHeight}px` }}
          >
            {/* The splitter sits over the grid's edge, outside the treegrid (#943). */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={ganttGridRef}
                id={gridId}
                role="treegrid"
                aria-label={gridName}
                aria-rowcount={rowCount}
                // Busy while a chunk of the buffer or a page of the row list loads (ADR 0089).
                aria-busy={
                  state.status === 'loading' ||
                  unloaded.some((chunk) => chunk.status === 'loading') ||
                  drawnList.next === 'loading' ||
                  undefined
                }
                onKeyDown={(event) => {
                  // Alt+Page Up and Alt+Page Down move in time, from a row or a header; a move in
                  // progress keeps the view, since the keys and the view belong to it.
                  if (
                    event.altKey &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    (event.key === 'PageDown' || event.key === 'PageUp')
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (moveStore.get() === undefined) {
                      pageInTime(
                        event.key === 'PageDown' ? 'later' : 'earlier',
                        event.target as HTMLElement,
                      );
                    }
                    return;
                  }
                  // Minus and plus zoom by a factor of 2 at the focused block (ADR 0090).
                  if (timelineZoom.onKeyDown(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  // The Escape stack: move mode ends first, then the chain highlight.
                  // The move is read from its store, so a move that begins renders no rows.
                  if (event.key === 'Escape' && moveStore.get() !== undefined) {
                    event.stopPropagation();
                    moveActions?.cancel();
                  } else if (event.key === 'Escape' && chain !== undefined) {
                    event.stopPropagation();
                    void setSearch(withChain(search, false));
                  }
                }}
                onFocus={treeScroll.onFocus}
                onScroll={(event) => {
                  buffer.onScroll();
                  followGrid();
                  loadMoreRows(event.currentTarget);
                }}
                className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-border bg-card text-sm"
                style={{
                  scrollPaddingTop: `${timeHeaderHeightRem + notPlacedHeightRem}rem`,
                  scrollPaddingInlineStart: `${paneWidth}px`,
                  // The zoom buttons sit over the lower right corner, and the pane's scrollbar
                  // sticks at the bottom, so focus stays clear of both (WCAG 2.4.11).
                  scrollPaddingBottom: zoomOverlayReserve.bottom,
                  scrollPaddingInlineEnd: zoomOverlayReserve.end,
                  // One finger scrolls; a pinch zooms the timeline, not the page (ADR 0089).
                  touchAction: 'pan-x pan-y',
                }}
              >
                <div
                  role="row"
                  aria-rowindex={1}
                  // As wide as its tracks, as GanttRowView's rows are (#890).
                  className="sticky top-0 z-20 grid w-max min-w-full border-b border-border bg-muted"
                  style={{ gridTemplateColumns, height: `${timeHeaderHeightRem}rem` }}
                >
                  <GanttTreeHeaderCells
                    columns={columns}
                    layout={pane}
                    sort={sort}
                    onSortChange={setSort}
                    onColumnWidthChange={changeColumnWidth}
                  />
                  <GanttTimeHeader scale={scale} nowMs={snapshot.nowMs} />
                </div>
                <GanttNotPlacedRow rows={unplaced} gridTemplateColumns={gridTemplateColumns} />
                <div className="relative">
                  {flatRows.map((row, index) => {
                    const parent = row.getParentRow();
                    // Order rows count every order of the row list, loaded or not.
                    const siblings =
                      parent === undefined
                        ? Math.max(rows.length, drawnList.totalCount ?? 0)
                        : parent.subRows.length;
                    return (
                      <GanttRowView
                        key={row.id}
                        row={row}
                        columns={columns}
                        gridTemplateColumns={gridTemplateColumns}
                        pane={pane}
                        rowIndex={index + 3}
                        setSize={siblings}
                        posInSet={row.index + 1}
                        focused={row.id === focusedId}
                        onFocus={() => setFocusedRowId(row.id)}
                        onKeyDown={(event) => onRowKeyDown(event, row, index)}
                        onSelect={(extend) => {
                          if (extend === true) {
                            extendSelection(row.original.order.id);
                            return;
                          }
                          selectUnlessSelected(row.original.order.id);
                        }}
                        onOpen={() => openDetails(row)}
                        onToggle={() => row.toggleExpanded()}
                      />
                    );
                  })}
                  {drawnList.next !== 'done' && (
                    <GanttMoreRows
                      rowIndex={flatRows.length + 3}
                      state={drawnList.next}
                      loaded={drawnList.orders.length}
                      total={drawnList.totalCount}
                      gridTemplateColumns={gridTemplateColumns}
                      onRetry={drawnList.retry}
                    />
                  )}
                  {/* A stacking context of its own under the tree panes (z-10), so no layer it
                    draws reaches over them (#943). */}
                  <div
                    aria-hidden
                    data-overlay
                    className="pointer-events-none absolute top-0 z-0"
                    style={{
                      left: `${paneWidth}px`,
                      width: `${timeWidth}px`,
                      height: `${totalHeight}px`,
                    }}
                  >
                    <ChunkBands
                      chunks={banded}
                      scale={scale}
                      labelTop={`${timeHeaderHeightRem + notPlacedHeightRem}rem`}
                    />
                    <GanttMarkerLayer markers={overlayMarkers(snapshot)} scale={scale} />
                    <GanttLinks links={links} width={timeWidth} height={totalHeight} />
                  </div>
                </div>
                {paneScrolls && (
                  // The tree pane's own scrollbar, which the browser draws, in a strip under the rows
                  // at the pane's width. It is for the pointer: the keyboard reaches every column by
                  // its header, which scrolls into the pane on focus, so the bar takes no Tab stop
                  // (#943).
                  <div
                    ref={treeScroll.scrollerRef}
                    aria-hidden
                    tabIndex={-1}
                    data-tree-scroller
                    onScroll={treeScroll.onScrollerScroll}
                    className="sticky start-0 bottom-0 z-10 flex min-h-(--nm-target-min) items-end overflow-x-auto overflow-y-hidden border-e border-t border-border bg-muted"
                    style={{ width: `${paneWidth}px` }}
                  >
                    <div className="h-px shrink-0" style={{ width: `${pane.contentWidth}px` }} />
                  </div>
                )}
              </div>
              <GanttSplitter
                layout={pane}
                viewWidth={width}
                gridId={gridId}
                gripHeightRem={timeHeaderHeightRem}
                onShareChange={(treePaneShare) => setOptions({ treePaneShare })}
              />
              <ZoomOverlay
                zoom={{ band: zoom, pxPerHour: buffer.pxPerHour }}
                onZoomStep={timelineZoom.step}
                onZoomToFit={() => {
                  // The row in the Details drawer, else the selected order or its run, else
                  // every loaded row.
                  const selected =
                    search.order === undefined ? undefined : rowById.get(search.order);
                  const target = fitTargetOf(detailRow ?? selectionRowOf(selected, rowById), rows);
                  timelineZoom.fit(target.span, target.name);
                }}
                ref={zoomOverlay}
              />
            </div>
            {options.workload && (
              <GanttWorkloadPanel
                snapshot={snapshot}
                scale={scale}
                treeWidth={paneWidth}
                stickyWidth={paneWidth}
                timeWidth={timeWidth}
                moveStore={moveStore}
                {...(buffer.settled !== undefined && { visible: buffer.settled })}
                scrollerRef={workloadRef}
                pending={
                  // Every bucket waits while pages of the row list still load.
                  rowList.next === 'done' || range === undefined
                    ? banded
                    : [...banded, { ...range, status: 'loading' as const }]
                }
                onScroll={(left) => {
                  const grid = gridElement.current;
                  if (grid === null || grid.scrollLeft === left) return;
                  grid.scrollLeft = left;
                  buffer.onScroll();
                }}
              />
            )}
          </div>
          <GanttDraftDrawer
            open={draftOpen}
            onClose={() => setDraftOpen(false)}
            draft={draft}
            conflicts={conflicts}
            timeZone={timeZone}
            machineName={view.machineName}
            onCascadeFromHere={(conflict: DraftConflict) => {
              const { draft: next, refused } = cascadeFromHere(
                committed ?? snapshot,
                draft,
                conflict,
              );
              if (refused !== undefined) announce(refusalMessage(conflict.rows[0], refused));
              else setDraft(next);
            }}
            onMoveBack={(conflict: DraftConflict) => setDraft(moveBack(draft, conflict))}
            onDiscardChange={(jobOrderId) => setDraft(discardChange(draft, jobOrderId))}
            onSplitRun={(runId) => runActions?.split(runId)}
            onDiscardDraft={() => setDraft(emptyDraft)}
            // With no changes left, My draft has left the bar, so focus goes to the order filter.
            finalFocus={() =>
              draftChangeCount(draft) === 0 ? filterInput.current : (draftOpener.current ?? null)
            }
          />
          <GanttRunDialog
            open={runReview !== undefined}
            result={runResult}
            orders={snapshot.productionOrders}
            timeZone={timeZone}
            machineName={view.machineName}
            onCombine={combineRun}
            onCancel={() => setRunReview(undefined)}
          />
          <GanttDetailDrawer
            row={detailRow}
            chain={chain}
            onClose={() => closeDetails()}
            onToggleChain={toggleChain}
            onFocusRow={(rowId) => closeDetails(rowId)}
            onMoveApplied={closeDetailsToBlock}
            finalFocus={drawerFinalFocus}
          />
        </GanttViewProvider>
      )}
    </PageFrame>
  );
}
