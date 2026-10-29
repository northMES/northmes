// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useShell } from '@northmes/web-sdk';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ExpandedState } from '@tanstack/react-table';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useBoardFields } from '../../board-fields-store.ts';
import type { GanttDataSource, GanttSnapshot } from '../../gantt-data.ts';
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
import {
  droppedKeyMessage,
  type GanttSearch,
  ganttSearch,
  withChain,
  withFrom,
  withOrder,
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
import {
  type ClosedWindow,
  createTimeScale,
  extendedRange,
  naturalWidthPx,
  plantDateOf,
  rangeLabel,
  rangeOf,
  shiftedFrom,
} from '../../timeline/time-scale.ts';
import { remPx, useMeasuredWidth, useViewportFill } from '../../use-grid-size.ts';
import { useMoveActions } from '../../use-move-actions.ts';
import { chainOf } from './gantt-chain.ts';
import { type GanttRunActions, type GanttViewContext, GanttViewProvider } from './gantt-context.ts';
import { GanttDetailDrawer } from './gantt-detail-panel.tsx';
import { GanttDraftDrawer } from './gantt-draft-drawer.tsx';
import { GanttLinks, linksOf } from './gantt-links.tsx';
import { GanttMarkerLayer, overlayMarkers } from './gantt-marker-layer.tsx';
import { refusalMessage } from './gantt-move.ts';
import { GanttNotPlacedRow } from './gantt-not-placed-row.tsx';
import { useGanttOptions } from './gantt-options.ts';
import { GanttRowView } from './gantt-row.tsx';
import {
  buildGanttRows,
  type GanttRow,
  type JobOrderRow,
  notPlacedRows,
  rowHeightRem,
} from './gantt-rows.ts';
import { GanttRunDialog } from './gantt-run-dialog.tsx';
import { GanttTimeHeader, timeHeaderHeightRem } from './gantt-time-area.tsx';
import { GanttToolbar } from './gantt-toolbar.tsx';
import {
  type GanttSort,
  type GanttTableRow,
  GanttTreeHeaderCells,
  useGanttTable,
  visibleColumns,
} from './gantt-tree-pane.tsx';
import { GanttWorkloadPanel } from './gantt-workload-panel.tsx';

export interface GanttScreenProps {
  /** Where the Gantt reads from; the fixture G1 until the GraphQL source exists (plan 18). */
  readonly source?: GanttDataSource;
}

/** The Gantt opens at Week zoom (D5); the board's own default comes with the board. */
const defaultZoom = 'week';

/** The width the tree pane may take of the view, as the machine column on the board. */
const treePaneShare = 0.4;

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
  const [committed, setSnapshot] = useState<GanttSnapshot | undefined>(undefined);
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
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [options, setOptions] = useGanttOptions();
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [sort, setSort] = useState<GanttSort | undefined>(undefined);
  const [focusedRowId, setFocusedRowId] = useState<string | undefined>(undefined);
  // The row the docked panel shows, opened by a click or by Enter, and whether the panel is open.
  const [detailRowId, setDetailRowId] = useState<string | undefined>(undefined);
  /** The row that takes focus when the drawer closes: the opened row, or the row a chain link named. */
  const returnRowId = useRef<string | undefined>(undefined);
  const [width, gridRef] = useMeasuredWidth();
  const zoom = search.zoom ?? defaultZoom;
  const [fillHeight, fillRef] = useViewportFill(
    `${zoom}|${search.from ?? ''}|${options.hideClosed}|${options.workload}`,
  );

  const timeZone = committed?.plant.timeZone ?? 'UTC';
  const productionDayStart = committed?.plant.productionDayStart ?? '06:00';
  // The range starts at the date in the URL, else at the snapshot's now, else at today.
  const from =
    search.from ??
    (committed === undefined
      ? plantDateOf(Date.now(), timeZone)
      : plantDateOf(committed.nowMs, timeZone));
  // The chosen range names the grid and the toolbar; the loaded range grows by whole spans of the
  // preset as the planner scrolls towards an edge (#685), and shrinks back when from or zoom change.
  const chosenRange = useMemo(
    () => rangeOf(from, zoom, timeZone, productionDayStart),
    [from, zoom, timeZone, productionDayStart],
  );
  // The extension belongs to one chosen start and zoom; a change of either resets it in the same
  // render, through state, as React's rule for state derived from props says.
  const extensionKey = `${from}|${zoom}`;
  const [extended, setExtended] = useState({ key: extensionKey, before: 0, after: 0 });
  if (extended.key !== extensionKey) setExtended({ key: extensionKey, before: 0, after: 0 });
  const extension = extended.key === extensionKey ? extended : { before: 0, after: 0 };
  const setExtension = (
    update: (current: { before: number; after: number }) => { before: number; after: number },
  ) =>
    setExtended((current) => {
      const base = current.key === extensionKey ? current : { before: 0, after: 0 };
      return { key: extensionKey, ...update(base) };
    });
  const range = useMemo(
    () => extendedRange(from, zoom, timeZone, productionDayStart, extension),
    [from, zoom, timeZone, productionDayStart, extension.before, extension.after],
  );
  // Everything the view draws reads the plan with the draft applied, analysed over the loaded
  // range (plan 18, Resolving a break in the draft).
  const snapshot = useMemo(
    () => (committed === undefined ? undefined : applyDraft(committed, draft, range)),
    [committed, draft, range],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadError(undefined);
    source
      .load({
        from: new Date(range.fromMs).toISOString(),
        to: new Date(range.toMs).toISOString(),
        filter: {},
      })
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error ?? new Error('The Gantt could not be loaded'));
      });
    return () => {
      cancelled = true;
    };
  }, [source, range.fromMs, range.toMs, attempt]);

  // chain without order is dropped with the polite status message (ADR 0062, plan 18).
  const droppedChain = search.chain !== undefined && search.order === undefined;
  useEffect(() => {
    if (!droppedChain) return;
    const { chain: _, ...rest } = search;
    void setSearch(rest);
    announce(droppedKeyMessage);
  }, [droppedChain, search, setSearch]);

  const rows = useMemo(() => (snapshot === undefined ? [] : buildGanttRows(snapshot)), [snapshot]);
  const columns = useMemo(() => visibleColumns(options.hiddenColumns), [options.hiddenColumns]);
  // The tree pane takes its columns' widths up to 40 percent of the view; the Name column gives
  // way first. While the pane fits the cap every tree cell sticks and the time column scrolls under
  // it; beyond the cap only the Name column sticks and the rest scrolls with the time, so the
  // time area stays reachable on a narrow grid (WCAG 1.4.10).
  const cap = Math.floor(width * treePaneShare);
  const fixedWidth = columns.slice(1).reduce((sum, column) => sum + column.widthPx, 0);
  const nameWidth = Math.max(160, Math.min(columns[0]?.widthPx ?? 300, cap - fixedWidth));
  // The tree columns' width as the grid lays them out, which may exceed the cap; the overlay
  // starts where the time column starts.
  const treeWidth = nameWidth + fixedWidth;
  const stickyTree = treeWidth <= cap;
  // The left offset of each tree column, where its cells stick while the time column scrolls.
  const cellLefts = columns.map((_, index) =>
    index === 0 ? 0 : nameWidth + columns.slice(1, index).reduce((sum, c) => sum + c.widthPx, 0),
  );

  const plantClosed = useMemo(
    () => (snapshot === undefined ? [] : closedWindows(snapshot.calendar, timeZone, range)),
    [snapshot, timeZone, range],
  );
  const closedByCalendar = useMemo(() => {
    const byName = new Map<string, readonly ClosedWindow[]>();
    if (snapshot !== undefined) byName.set(snapshot.calendar.name, plantClosed);
    return byName;
  }, [snapshot, plantClosed]);
  // The time area takes the preset's natural width when that is wider than the space beside the
  // tree pane, and scrolls sideways inside the grid under the sticky tree columns.
  const hideClosed = options.hideClosed ? { closed: plantClosed } : undefined;
  const timeWidth = Math.max(
    width - Math.min(treeWidth, cap),
    Math.ceil(naturalWidthPx(range, zoom, hideClosed)),
  );
  // A span added before the range widens the time column on the left: the scroll position moves by
  // the added width in the same frame, so what was in view stays in view.
  const lastTimeWidth = useRef<number | undefined>(undefined);
  const shiftAfterGrowth = useRef(false);
  const gridElement = useRef<HTMLElement | null>(null);
  // An edge counts only after a horizontal move of the planner towards it: a vertical scroll
  // changes nothing, a range under two screens wide extends on the side the planner is heading
  // for, and a move of the position the view makes itself (the shift after a span was added on
  // the left, the clamp after the range shrank) counts as the new baseline, not as a move.
  const lastScrollLeft = useRef(0);
  useLayoutEffect(() => {
    const previous = lastTimeWidth.current;
    lastTimeWidth.current = timeWidth;
    const grid = gridElement.current;
    if (grid === null) return;
    if (shiftAfterGrowth.current && previous !== undefined && timeWidth > previous) {
      grid.scrollLeft += timeWidth - previous;
    }
    shiftAfterGrowth.current = false;
    // The browser has laid the new width out and clamped the position by now.
    lastScrollLeft.current = grid.scrollLeft;
  }, [timeWidth]);
  const onGridScroll = (grid: HTMLElement) => {
    const { scrollLeft, clientWidth, scrollWidth } = grid;
    const previous = lastScrollLeft.current;
    lastScrollLeft.current = scrollLeft;
    if (clientWidth <= 0 || scrollLeft === previous) return;
    if (scrollLeft > previous && scrollLeft + clientWidth >= scrollWidth - clientWidth) {
      setExtension((current) => ({ ...current, after: current.after + 1 }));
    } else if (scrollLeft < previous && scrollLeft <= clientWidth) {
      shiftAfterGrowth.current = true;
      setExtension((current) => ({ ...current, before: current.before + 1 }));
    }
  };
  const gridTemplateColumns = [
    `${nameWidth}px`,
    ...columns.slice(1).map((column) => `${column.widthPx}px`),
    `${timeWidth}px`,
  ].join(' ');
  const scale = useMemo(
    () =>
      createTimeScale({
        range,
        zoom,
        timeZone,
        widthPx: timeWidth,
        ...(options.hideClosed && { hideClosed: { closed: plantClosed } }),
      }),
    [range, zoom, timeZone, timeWidth, options.hideClosed, plantClosed],
  );

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
  // A block takes focus and scrolls into view past the sticky tree pane and the time header, which
  // the grid's scroll padding keeps it clear of (WCAG 2.4.11).
  const focusBlock = (jobOrderId: string) => {
    const block = document.querySelector<HTMLElement>(`[data-block="${jobOrderId}"]`);
    block?.focus({ preventScroll: true });
    block?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const { actions: moveActions, state: moveState } = useMoveActions({
    committed,
    snapshot,
    draft,
    setDraft,
    cascadeOn: options.cascade,
    zoom,
    range,
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
    if (snapshot === undefined) return undefined;
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
    snapshot === undefined
      ? { links: [], limited: false }
      : linksOf(linkRows, snapshot, scale, search.order);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && loadError !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the Gantt',
      error: loadError,
      onRetry: async () => setAttempt((count) => count + 1),
    };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No orders in this range',
      description: 'Show an earlier or later range, or widen the filter.',
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
      case 'Enter':
        if (onRow) openDetails(row);
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
        if (moveState !== undefined) moveActions?.cancel();
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

  const gridName = `${plant} order Gantt, ${rangeLabel(chosenRange, zoom, timeZone)}`;
  const rowCount = flatRows.length + 2;
  const focusedId =
    focusedRowId !== undefined && flatRows.some((row) => row.id === focusedRowId)
      ? focusedRowId
      : flatRows[0]?.id;

  return (
    <PageFrame
      title="Gantt"
      state={state}
      toolbar={
        <GanttToolbar
          zoom={zoom}
          onZoomChange={(next) => void setSearch(withZoom(search, next))}
          from={from}
          onFromChange={(next) => void setSearch(withFrom(search, next))}
          onEarlier={() => void setSearch(withFrom(search, shiftedFrom(from, zoom, 'earlier')))}
          onNow={() =>
            void setSearch(withFrom(search, plantDateOf(snapshot?.nowMs ?? Date.now(), timeZone)))
          }
          onLater={() => void setSearch(withFrom(search, shiftedFrom(from, zoom, 'later')))}
          rangeLabel={rangeLabel(chosenRange, zoom, timeZone)}
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
      <p className="text-xs text-muted-foreground" data-testid="gantt-status">
        {[
          snapshot?.fixture !== undefined ? `Showing fixture ${snapshot.fixture}.` : undefined,
          limited ? 'Links shown for the selected order.' : undefined,
        ]
          .filter((part) => part !== undefined)
          .join(' ')}
      </p>
      {view !== undefined && snapshot !== undefined && (
        <GanttViewProvider value={view}>
          <div
            ref={fillRef}
            data-gantt-fill
            className="flex min-w-0 flex-col gap-3"
            style={fillHeight === undefined ? undefined : { height: `${fillHeight}px` }}
          >
            <div
              ref={(node) => {
                gridElement.current = node;
                gridRef(node);
              }}
              role="treegrid"
              aria-label={gridName}
              aria-rowcount={rowCount}
              aria-busy={state.status === 'loading' || undefined}
              onKeyDown={(event) => {
                // The Escape stack: move mode ends first, then the chain highlight.
                if (event.key === 'Escape' && moveState !== undefined) {
                  event.stopPropagation();
                  moveActions?.cancel();
                } else if (event.key === 'Escape' && chain !== undefined) {
                  event.stopPropagation();
                  void setSearch(withChain(search, false));
                }
              }}
              onScroll={(event) => onGridScroll(event.currentTarget)}
              className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-border bg-card text-sm"
              style={{
                scrollPaddingTop: `${timeHeaderHeightRem}rem`,
                scrollPaddingInlineStart: `${stickyTree ? treeWidth : nameWidth}px`,
              }}
            >
              <div
                role="row"
                aria-rowindex={1}
                className="sticky top-0 z-20 grid border-b border-border bg-muted"
                style={{ gridTemplateColumns, height: `${timeHeaderHeightRem}rem` }}
              >
                <GanttTreeHeaderCells
                  columns={columns}
                  cellLefts={cellLefts}
                  stickyTree={stickyTree}
                  sort={sort}
                  onSortChange={setSort}
                />
                <GanttTimeHeader scale={scale} nowMs={snapshot.nowMs} />
              </div>
              <GanttNotPlacedRow
                rows={unplaced}
                gridTemplateColumns={gridTemplateColumns}
                columnCount={columns.length}
              />
              <div className="relative">
                {flatRows.map((row, index) => {
                  const parent = row.getParentRow();
                  const siblings = parent === undefined ? rows.length : parent.subRows.length;
                  return (
                    <GanttRowView
                      key={row.id}
                      row={row}
                      columns={columns}
                      gridTemplateColumns={gridTemplateColumns}
                      cellLefts={cellLefts}
                      stickyTree={stickyTree}
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
                <div
                  aria-hidden
                  data-overlay
                  className="pointer-events-none absolute top-0"
                  style={{
                    left: `${treeWidth}px`,
                    width: `${timeWidth}px`,
                    height: `${totalHeight}px`,
                  }}
                >
                  <GanttMarkerLayer markers={overlayMarkers(snapshot)} scale={scale} />
                  <GanttLinks links={links} width={timeWidth} height={totalHeight} />
                </div>
              </div>
            </div>
            {options.workload && (
              <GanttWorkloadPanel
                snapshot={snapshot}
                scale={scale}
                treeWidth={treeWidth}
                timeWidth={timeWidth}
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
            finalFocus={() => draftOpener.current ?? null}
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
