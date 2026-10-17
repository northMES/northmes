// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useShell } from '@northmes/web-sdk';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ExpandedState } from '@tanstack/react-table';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import type { GanttDataSource, GanttSnapshot } from '../../gantt-data.ts';
import {
  type BoardSearch,
  boardSearch,
  droppedKeyMessage,
  withChain,
  withFrom,
  withOrder,
  withView,
  withZoom,
} from '../../gantt-search.ts';
import { useGanttSource } from '../../gantt-source-context.ts';
import { closedWindows } from '../../timeline/availability-shading.ts';
import {
  type ClosedWindow,
  createTimeScale,
  plantDateOf,
  rangeLabel,
  rangeOf,
  shiftedFrom,
} from '../../timeline/time-scale.ts';
import { chainOf } from './gantt-chain.ts';
import { type GanttViewContext, GanttViewProvider } from './gantt-context.ts';
import { GanttDetailPanel } from './gantt-detail-panel.tsx';
import { GanttLinks, linksOf } from './gantt-links.tsx';
import { GanttMarkerLayer, overlayMarkers } from './gantt-marker-layer.tsx';
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
  const search = boardSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const setSearch = useCallback(
    (next: BoardSearch) =>
      navigate({ to: '.', search: next as Record<string, unknown>, replace: true }),
    [navigate],
  );
  const [snapshot, setSnapshot] = useState<GanttSnapshot | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [options, setOptions] = useGanttOptions();
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [sort, setSort] = useState<GanttSort | undefined>(undefined);
  const [focusedRowId, setFocusedRowId] = useState<string | undefined>(undefined);
  // The row the docked panel shows, opened by a click or by Enter, and whether the panel is open.
  const [detailRowId, setDetailRowId] = useState<string | undefined>(undefined);
  const [panelOpen, setPanelOpen] = useState(true);
  const [width, gridRef] = useMeasuredWidth();

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
  // way first. Columns beyond the cap keep their width and the grid scrolls sideways under the
  // sticky Name column, so the time area keeps at least 60 percent of the view.
  const cap = Math.floor(width * treePaneShare);
  const fixedWidth = columns.slice(1).reduce((sum, column) => sum + column.widthPx, 0);
  const nameWidth = Math.max(160, Math.min(columns[0]?.widthPx ?? 300, cap - fixedWidth));
  // The tree columns' width as the grid lays them out, which may exceed the cap; the overlay
  // starts where the time column starts.
  const treeWidth = nameWidth + fixedWidth;
  const timeWidth = Math.max(480, width - Math.min(treeWidth, cap));
  const gridTemplateColumns = [
    `${nameWidth}px`,
    ...columns.slice(1).map((column) => `${column.widthPx}px`),
    `${timeWidth}px`,
  ].join(' ');

  const plantClosed = useMemo(
    () => (snapshot === undefined ? [] : closedWindows(snapshot.calendar, timeZone, range)),
    [snapshot, timeZone, range],
  );
  const closedByCalendar = useMemo(() => {
    const byName = new Map<string, readonly ClosedWindow[]>();
    if (snapshot !== undefined) byName.set(snapshot.calendar.name, plantClosed);
    return byName;
  }, [snapshot, plantClosed]);
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
  const onRowKeyDown = (_event: KeyboardEvent<HTMLDivElement>) => {
    // Row focus mode comes with the keyboard behaviour group.
  };

  const gridName = `${plant} order Gantt, ${rangeLabel(range, zoom, timeZone)}`;
  const rowCount = flatRows.length + 2;
  const focusedId =
    focusedRowId !== undefined && flatRows.some((row) => row.id === focusedRowId)
      ? focusedRowId
      : flatRows[0]?.id;

  return (
    <PageFrame
      title="Planning board"
      state={state}
      toolbar={
        <GanttToolbar
          view="gantt"
          onViewChange={(next) => void setSearch(withView(search, next))}
          zoom={zoom}
          onZoomChange={(next) => void setSearch(withZoom(search, next))}
          from={from}
          onFromChange={(next) => void setSearch(withFrom(search, next))}
          onEarlier={() => void setSearch(withFrom(search, shiftedFrom(from, zoom, 'earlier')))}
          onNow={() =>
            void setSearch(withFrom(search, plantDateOf(snapshot?.nowMs ?? Date.now(), timeZone)))
          }
          onLater={() => void setSearch(withFrom(search, shiftedFrom(from, zoom, 'later')))}
          rangeLabel={rangeLabel(range, zoom, timeZone)}
          options={options}
          onOptionsChange={setOptions}
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
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div
                ref={gridRef}
                role="treegrid"
                aria-label={gridName}
                aria-rowcount={rowCount}
                aria-busy={state.status === 'loading' || undefined}
                onKeyDown={(event) => {
                  // The Escape stack: the chain highlight ends first.
                  if (event.key === 'Escape' && chain !== undefined) {
                    event.stopPropagation();
                    void setSearch(withChain(search, false));
                  }
                }}
                className="max-h-[75vh] overflow-auto rounded-lg border border-border bg-card text-sm"
              >
                <div
                  role="row"
                  aria-rowindex={1}
                  className="sticky top-0 z-20 grid border-b border-border bg-muted"
                  style={{ gridTemplateColumns, height: `${timeHeaderHeightRem}rem` }}
                >
                  <GanttTreeHeaderCells columns={columns} sort={sort} onSortChange={setSort} />
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
                        rowIndex={index + 3}
                        setSize={siblings}
                        posInSet={row.index + 1}
                        focused={row.id === focusedId}
                        onFocus={() => setFocusedRowId(row.id)}
                        onKeyDown={onRowKeyDown}
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
            <GanttDetailPanel
              row={detailRow}
              chain={chain}
              open={panelOpen}
              onOpenChange={setPanelOpen}
              onToggleChain={toggleChain}
              onFocusRow={focusRow}
            />
          </div>
        </GanttViewProvider>
      )}
    </PageFrame>
  );
}
