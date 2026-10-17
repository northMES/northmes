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
import type { GanttDataSource, GanttSnapshot } from '../../gantt-data.ts';
import {
  applyDraft,
  cascadeFromHere,
  type DraftConflict,
  discardChange,
  draftConflicts,
  draftRowIds,
  emptyDraft,
  type GanttDraft,
  moveBack,
  moveInDraft,
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
  zoomPresets,
} from '../../timeline/time-scale.ts';
import { chainOf } from './gantt-chain.ts';
import {
  type GanttMoveActions,
  type GanttViewContext,
  GanttViewProvider,
} from './gantt-context.ts';
import { GanttDetailDrawer } from './gantt-detail-panel.tsx';
import { GanttDraftDrawer } from './gantt-draft-drawer.tsx';
import { GanttLinks, linksOf } from './gantt-links.tsx';
import { GanttMarkerLayer, overlayMarkers } from './gantt-marker-layer.tsx';
import {
  type MoveState,
  movedMessage,
  moveRefusalOf,
  previewOf,
  refusalMessage,
  stepMessage,
} from './gantt-move.ts';
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

/** The width the view assumes before it has measured itself, as in a test. */
const assumedWidth = 1100;

/** The least height the grid keeps, in rem: a few rows under the header and the Not placed row. */
const minFillRem = 15;

/** The space the page leaves under the grid: the bottom padding of the main area it sits in. */
function bottomGapOf(node: HTMLElement): number {
  const main = node.closest('main');
  const padding =
    main === null ? Number.NaN : Number.parseFloat(getComputedStyle(main).paddingBottom);
  return Number.isFinite(padding) ? padding : 0;
}

/**
 * The height that fills the viewport from an element's top (plan 18, phase 1 findings): the grid
 * takes it, so the page itself never scrolls and the rows scroll inside the grid under the sticky
 * time header. Measured again when the window resizes.
 */
function useViewportFill(
  layoutKey: string,
): [number | undefined, (node: HTMLElement | null) => void] {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const element = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | undefined>(undefined);
  const measure = useCallback(() => {
    const node = element.current;
    if (node === null || typeof window === 'undefined') return;
    // Viewport coordinates, as innerHeight is: the page may hold a restored scroll position.
    const top = node.getBoundingClientRect().top;
    setHeight(Math.max(minFillRem * remPx(), window.innerHeight - top - bottomGapOf(node)));
  }, []);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      element.current = node;
      observer.current?.disconnect();
      observer.current = undefined;
      measure();
      // The toolbar above wraps its controls, so the parent's height changes move the grid's top.
      if (node?.parentElement && typeof ResizeObserver !== 'undefined') {
        observer.current = new ResizeObserver(() => measure());
        observer.current.observe(node.parentElement);
      }
    },
    [measure],
  );
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  // A zoom or range change redraws the toolbar's range label, which may wrap or unwrap.
  useEffect(() => {
    measure();
  }, [measure, layoutKey]);
  return [height, ref];
}

/** The pixels of one rem, which the row heights are in, read from the document once it exists. */
function remPx(): number {
  if (typeof document === 'undefined') return 16;
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

/** The width of the whole grid, measured through a ResizeObserver where the browser has one. */
function useMeasuredWidth(): [number, (node: HTMLElement | null) => void] {
  const [width, setWidth] = useState(assumedWidth);
  const observer = useRef<ResizeObserver | undefined>(undefined);
  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = undefined;
    if (node === null || typeof ResizeObserver === 'undefined') return;
    const measured = node.getBoundingClientRect().width;
    if (measured > 0) setWidth(measured);
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined && entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.current.observe(node);
  }, []);
  return [width, ref];
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
  const search = ganttSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const setSearch = useCallback(
    (next: GanttSearch) =>
      navigate({ to: '.', search: next as Record<string, unknown>, replace: true }),
    [navigate],
  );
  const [committed, setSnapshot] = useState<GanttSnapshot | undefined>(undefined);
  // The planner's draft, in memory until the plan server exists, and the move in progress.
  const [draft, setDraft] = useState<GanttDraft>(emptyDraft);
  const [moveState, setMoveState] = useState<MoveState | undefined>(undefined);
  const [draftOpen, setDraftOpen] = useState(false);
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
  const [extension, setExtension] = useState({ before: 0, after: 0 });
  const extendedFor = useRef(`${from}|${zoom}`);
  if (extendedFor.current !== `${from}|${zoom}`) {
    extendedFor.current = `${from}|${zoom}`;
    setExtension({ before: 0, after: 0 });
  }
  const range = useMemo(
    () => extendedRange(from, zoom, timeZone, productionDayStart, extension),
    [from, zoom, timeZone, productionDayStart, extension],
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
  useLayoutEffect(() => {
    const previous = lastTimeWidth.current;
    lastTimeWidth.current = timeWidth;
    if (!shiftAfterGrowth.current || previous === undefined) return;
    shiftAfterGrowth.current = false;
    const grid = gridElement.current;
    if (grid !== null && timeWidth > previous) grid.scrollLeft += timeWidth - previous;
  }, [timeWidth]);
  const onGridScroll = (grid: HTMLElement) => {
    const { scrollLeft, clientWidth, scrollWidth } = grid;
    if (clientWidth <= 0) return;
    if (scrollLeft + clientWidth >= scrollWidth - clientWidth) {
      setExtension((current) => ({ ...current, after: current.after + 1 }));
    } else if (scrollLeft <= clientWidth) {
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
  const preview = useMemo(
    () =>
      snapshot === undefined || moveState === undefined
        ? undefined
        : previewOf(snapshot, moveState, options.cascade),
    [snapshot, moveState, options.cascade],
  );
  // The step message of keyboard move mode, debounced to about 300 ms (plan 07, Moving without dragging).
  useEffect(() => {
    if (moveState?.source !== 'keyboard' || preview === undefined || snapshot === undefined) return;
    const machine =
      snapshot.equipment.find((each) => each.code === preview.equipment)?.name ?? preview.equipment;
    const timer = setTimeout(() => announce(stepMessage(preview, machine, timeZone)), 300);
    return () => clearTimeout(timer);
  }, [moveState?.source, preview, snapshot, timeZone]);
  // A block takes focus and scrolls into view past the sticky tree pane and the time header, which
  // the grid's scroll padding keeps it clear of (WCAG 2.4.11).
  const focusBlock = (jobOrderId: string) => {
    const block = document.querySelector<HTMLElement>(`[data-block="${jobOrderId}"]`);
    block?.focus({ preventScroll: true });
    block?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const moveActions = useMemo<GanttMoveActions | undefined>(() => {
    if (snapshot === undefined || committed === undefined) return undefined;
    const machineOf = (code: string | undefined) =>
      snapshot.equipment.find((each) => each.code === code)?.name ?? code ?? 'no machine';
    const rowOf = (jobOrderId: string) => {
      const order = snapshot.productionOrders.find((each) =>
        each.jobOrders.some((row) => row.id === jobOrderId),
      );
      const row = order?.jobOrders.find((each) => each.id === jobOrderId);
      const operation = order?.operations.find((each) => each.id === row?.operationId);
      return { order, row, operation };
    };
    return {
      state: moveState,
      preview,
      begin: (jobOrderId, source) => {
        const { row } = rowOf(jobOrderId);
        if (row?.placement === undefined || row.equipment === undefined) return false;
        const refused = moveRefusalOf(snapshot, jobOrderId);
        if (refused !== undefined) {
          announce(refusalMessage(row.displayNumber, refused));
          return false;
        }
        setMoveState({
          jobOrderId,
          setupStartMs: row.placement.setupStartMs,
          equipment: row.equipment,
          source,
        });
        return true;
      },
      previewAt: (setupStartMs, equipment) =>
        setMoveState((current) =>
          current === undefined
            ? current
            : { ...current, setupStartMs, equipment: equipment ?? current.equipment },
        ),
      // A step moves one snap step; the preview then snaps forward to working time on the machine.
      // A step moves one snap step from the snapped preview. Backwards, the forward snap of the
      // calendar can land on the same instant again, so the step keeps going back until the
      // preview is earlier, or the horizon ends (plan 18, Snapping and the calendar).
      stepTime: (direction) =>
        setMoveState((current) => {
          if (current === undefined) return current;
          const stepMs = zoomPresets[zoom].stepMs;
          const from = preview?.span.setupStartMs ?? current.setupStartMs;
          let setupStartMs = from + direction * stepMs;
          if (direction < 0) {
            const floor = range.fromMs - 28 * 86_400_000;
            for (let count = 0; count < 500 && setupStartMs > floor; count += 1) {
              const next = previewOf(snapshot, { ...current, setupStartMs }, options.cascade);
              if (next === undefined || next.span.setupStartMs < from) break;
              // The row cannot start before its release or its last-piece bound: it stays.
              if (next.reason === 'snappedToRelease' || next.reason === 'snappedToLastPiece') {
                return current;
              }
              setupStartMs -= stepMs;
            }
          }
          return { ...current, setupStartMs };
        }),
      stepMachine: (direction) =>
        setMoveState((current) => {
          if (current === undefined) return current;
          const { operation } = rowOf(current.jobOrderId);
          const allowed = operation?.allowedEquipment ?? [];
          const index = allowed.indexOf(current.equipment);
          const next = allowed[Math.max(0, Math.min(allowed.length - 1, index + direction))];
          return next === undefined ? current : { ...current, equipment: next };
        }),
      commit: () => {
        if (moveState === undefined || preview === undefined) return;
        const { draft: next, result } = moveInDraft(
          committed,
          draft,
          {
            jobOrderId: moveState.jobOrderId,
            setupStartMs: moveState.setupStartMs,
            equipment: moveState.equipment,
          },
          { cascade: options.cascade },
        );
        setMoveState(undefined);
        if (result.refused !== undefined) {
          announce(refusalMessage(preview.displayNumber, result.refused));
          return;
        }
        setDraft(next);
        announce(movedMessage(preview, machineOf(preview.equipment), timeZone));
        // Focus returns to the block by id once it has drawn at its new place (plan 18).
        requestAnimationFrame(() => focusBlock(moveState.jobOrderId));
      },
      cancel: () => {
        if (moveState === undefined) return;
        setMoveState(undefined);
        announce('Move cancelled.');
        requestAnimationFrame(() => focusBlock(moveState.jobOrderId));
      },
    };
  }, [snapshot, committed, moveState, preview, draft, options.cascade, zoom, timeZone, range]);
  const rowById = useMemo(() => {
    const map = new Map<string, GanttRow>();
    for (const order of rows) {
      map.set(order.id, order);
      for (const operation of order.subRows) {
        map.set(operation.id, operation);
        for (const jobOrder of operation.subRows) map.set(jobOrder.id, jobOrder);
      }
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
      chainRowIds,
      machineName: (code) =>
        code === undefined ? 'no machine' : (equipment.get(code)?.name ?? code),
      draftRowIds: draftIds,
      move: moveActions,
    };
  }, [
    snapshot,
    scale,
    plantClosed,
    closedByCalendar,
    timeZone,
    options.hideClosed,
    search.order,
    chainRowIds,
    draftIds,
    moveActions,
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

  const selectOrder = (orderId: string) => {
    if (search.order !== orderId) void setSearch(withOrder(search, orderId));
  };
  // Show critical chain on an order selects it and turns the chain on; on the shown order it ends.
  const toggleChain = (orderId: string) => {
    if (chain?.order.id === orderId) void setSearch(withChain(search, false));
    else void setSearch(withChain(withOrder(search, orderId), true));
  };
  const focusRow = (rowId: string) => {
    setFocusedRowId(rowId);
    document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`)?.focus();
  };
  const focusRowAt = (index: number) => {
    const target = flatRows[Math.max(0, Math.min(flatRows.length - 1, index))];
    if (target !== undefined) focusRow(target.id);
  };
  const openDetails = (row: GanttTableRow) => {
    selectOrder(row.original.order.id);
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
          draftCount={draft.changes.length}
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
                      onSelect={() => {
                        selectOrder(row.original.order.id);
                        setDetailRowId(row.id);
                      }}
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
            onDiscardDraft={() => setDraft(emptyDraft)}
            finalFocus={() => draftOpener.current ?? null}
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
