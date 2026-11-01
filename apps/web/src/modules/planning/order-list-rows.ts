// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDate } from '@northmes/contracts/format';
import { Temporal } from 'temporal-polyfill';
import type { CustomerOrderLine, GanttOrder, GanttSnapshot, OrderAnalysis } from './gantt-data.ts';
import { customersOf, demandOf } from './order-facts.ts';
import {
  type CustomerOrderListSearch,
  type LineSortId,
  type ListFilterKey,
  notSupplied,
  type OrderGroupKey,
  type OrderListSearch,
  type OrderSortId,
} from './order-list-search.ts';
import { compareOrders, quantityText, statusLabel } from './screens/gantt/gantt-rows.ts';

/** One row of the production orders list: the order with its analysis and its customers. */
export interface OrderListRow {
  readonly id: string;
  readonly order: GanttOrder;
  readonly analysis: OrderAnalysis | undefined;
  /** The customers of the order's demand by name, each once; none for a stock order. */
  readonly customers: readonly string[];
  readonly customerCodes: readonly string[];
}

/** One row of the customer orders list: a line and the order that supplies it, if any. */
export interface LineListRow {
  readonly id: string;
  readonly line: CustomerOrderLine;
  readonly customerName: string;
  readonly order: GanttOrder | undefined;
  readonly analysis: OrderAnalysis | undefined;
  /** The supplying order's status, or none. */
  readonly status: string;
}

/** A value of a filter field with how many rows have it, for the menus and the chips. */
export interface FacetValue {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export function orderListRows(snapshot: GanttSnapshot): OrderListRow[] {
  return snapshot.productionOrders.map((order) => ({
    id: order.id,
    order,
    analysis: snapshot.analysis.orders[order.id],
    customers: customersOf(snapshot, order),
    customerCodes: [...new Set(demandOf(snapshot, order).map((line) => line.customerCode))],
  }));
}

export function lineListRows(snapshot: GanttSnapshot): LineListRow[] {
  const customers = new Map((snapshot.customers ?? []).map((each) => [each.code, each.name]));
  return (snapshot.customerOrderLines ?? []).map((line) => {
    const order = snapshot.productionOrders.find((each) => each.id === line.productionOrderId);
    return {
      id: line.id,
      line,
      customerName: customers.get(line.customerCode) ?? line.customerCode,
      order,
      analysis: order === undefined ? undefined : snapshot.analysis.orders[order.id],
      status: order === undefined ? notSupplied : order.status,
    };
  });
}

/** Whether a search text matches any of the texts, as a case-insensitive part. */
export function matches(q: string | undefined, ...texts: readonly string[]): boolean {
  if (q === undefined) return true;
  const needle = q.toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(needle));
}

/** The value of a filter field on an order row; a stock order has no customer. */
function orderFieldValues(row: OrderListRow, key: ListFilterKey): readonly string[] {
  switch (key) {
    case 'status':
      return [row.order.status];
    case 'article':
      return [row.order.article];
    case 'customer':
      return row.customerCodes;
  }
}

function lineFieldValues(row: LineListRow, key: ListFilterKey): readonly string[] {
  switch (key) {
    case 'status':
      return [row.status];
    case 'article':
      return [row.line.article];
    case 'customer':
      return [row.line.customerCode];
  }
}

const filterKeys: readonly ListFilterKey[] = ['status', 'article', 'customer'];

/** Whether an order row passes the view's search, Late only and filters, a field left out aside. */
export function orderRowMatches(
  row: OrderListRow,
  view: OrderListSearch,
  except?: ListFilterKey,
): boolean {
  if (view.late === 1 && row.analysis?.late !== true) return false;
  if (!matches(view.q, row.order.number, row.order.article, ...row.customers)) return false;
  return filterKeys.every((key) => {
    const picked = key === except ? undefined : view[key];
    return picked === undefined || orderFieldValues(row, key).some((v) => picked.includes(v));
  });
}

/** Whether a line row passes the view's search, Late only and filters, a field left out aside. */
export function lineRowMatches(
  row: LineListRow,
  view: CustomerOrderListSearch,
  except?: ListFilterKey,
): boolean {
  if (view.late === 1 && row.analysis?.late !== true) return false;
  if (
    !matches(
      view.q,
      row.line.customerOrder,
      row.line.customersReference,
      row.customerName,
      row.line.article,
      row.order?.number ?? '',
    )
  ) {
    return false;
  }
  return filterKeys.every((key) => {
    const picked = key === except ? undefined : view[key];
    return picked === undefined || lineFieldValues(row, key).some((v) => picked.includes(v));
  });
}

/**
 * The values of a filter field with their counts among the rows that pass every other part of the
 * view (design ui-222, LI3), so a menu says what picking a value adds.
 */
export function facetsOf<Row, Key extends string>(
  rows: readonly Row[],
  picked: readonly string[] | undefined,
  key: Key,
  passes: (row: Row, except: Key) => boolean,
  valuesOf: (row: Row, key: Key) => readonly string[],
  labelOf: (value: string) => string,
): FacetValue[] {
  // A picked value stays in the menu and names its chip even when no row passes with it.
  const counts = new Map<string, number>((picked ?? []).map((value) => [value, 0]));
  for (const row of rows) {
    if (!passes(row, key)) continue;
    for (const value of valuesOf(row, key)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labelOf(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const orderFacets = (
  rows: readonly OrderListRow[],
  view: OrderListSearch,
  key: ListFilterKey,
  labelOf: (value: string) => string,
) =>
  facetsOf(
    rows,
    view[key],
    key,
    (row, except) => orderRowMatches(row, view, except),
    orderFieldValues,
    labelOf,
  );

export const lineFacets = (
  rows: readonly LineListRow[],
  view: CustomerOrderListSearch,
  key: ListFilterKey,
  labelOf: (value: string) => string,
) =>
  facetsOf(
    rows,
    view[key],
    key,
    (row, except) => lineRowMatches(row, view, except),
    lineFieldValues,
    labelOf,
  );

/** The sort key of an order row under a column. */
function orderSortKey(row: OrderListRow, id: OrderSortId): number | string {
  switch (id) {
    case 'order':
      return row.order.number;
    case 'article':
      return row.order.article;
    case 'deadline':
      return row.order.deadlineMs;
    case 'priority':
      return row.order.priority ?? Number.MAX_SAFE_INTEGER;
    case 'plannedEnd':
      return row.analysis?.plannedEndMs ?? Number.MAX_SAFE_INTEGER;
  }
}

/**
 * The order rows sorted on a column, the autoplan order (deadline, priority, number) breaking
 * ties; the default sort is the autoplan order itself.
 */
export function sortedOrderRows(
  rows: readonly OrderListRow[],
  sort: { readonly id: OrderSortId; readonly desc: boolean },
): OrderListRow[] {
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort.id !== 'deadline') {
      const left = orderSortKey(a, sort.id);
      const right = orderSortKey(b, sort.id);
      if (left !== right) return (left < right ? -1 : 1) * direction;
    }
    return compareOrders(a.order, b.order) * (sort.id === 'deadline' ? direction : 1);
  });
}

function lineSortKey(row: LineListRow, id: LineSortId): string {
  switch (id) {
    case 'wanted':
      return row.line.wantedDate;
    case 'customerOrder':
      return `${row.line.customerOrder}-${String(row.line.line).padStart(3, '0')}`;
    case 'customer':
      return row.customerName;
    case 'article':
      return row.line.article;
  }
}

/** The line rows sorted on a column, the customer order and line breaking ties. */
export function sortedLineRows(
  rows: readonly LineListRow[],
  sort: { readonly id: LineSortId; readonly desc: boolean },
): LineListRow[] {
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = lineSortKey(a, sort.id);
    const right = lineSortKey(b, sort.id);
    if (left !== right) return (left < right ? -1 : 1) * direction;
    const tie = lineSortKey(a, 'customerOrder');
    const other = lineSortKey(b, 'customerOrder');
    return tie === other ? 0 : tie < other ? -1 : 1;
  });
}

/** One group of the production orders list, with its rows and their quantity. */
export interface OrderGroup {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly OrderListRow[];
  readonly quantity: number;
}

/** The ISO week of an instant in the plant zone, "W45". */
function isoWeekOf(epochMs: number, timeZone: string): string {
  const week =
    Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone).weekOfYear;
  return `W${week ?? '?'}`;
}

/** The values a row groups under, each with its label; a stock order groups under Stock order. */
function groupValues(
  row: OrderListRow,
  key: OrderGroupKey,
  snapshot: GanttSnapshot,
): readonly { readonly id: string; readonly label: string }[] {
  switch (key) {
    case 'article':
      return [{ id: row.order.article, label: row.order.article }];
    case 'customer':
      return row.customers.length === 0
        ? [{ id: 'stock', label: 'Stock order' }]
        : row.customers.map((name) => ({ id: name, label: name }));
    case 'status':
      return [{ id: row.order.status, label: statusLabel(row.order.status) }];
    case 'deadlineWeek': {
      const week = isoWeekOf(row.order.deadlineMs, snapshot.plant.timeZone);
      return [
        {
          id: week,
          label: `${week}, deadline ${formatPlantDate(row.order.deadlineMs, snapshot.plant.timeZone)}`,
        },
      ];
    }
  }
}

/** The sorted rows in groups under a field, the groups by label; an order with two customers sits in both. */
export function groupedOrderRows(
  rows: readonly OrderListRow[],
  key: OrderGroupKey,
  snapshot: GanttSnapshot,
): OrderGroup[] {
  const groups = new Map<string, { label: string; rows: OrderListRow[] }>();
  for (const row of rows) {
    for (const { id, label } of groupValues(row, key, snapshot)) {
      const group = groups.get(id) ?? { label, rows: [] };
      group.rows.push(row);
      groups.set(id, group);
    }
  }
  return [...groups.entries()]
    .map(([id, { label, rows: members }]) => ({
      id,
      label: key === 'deadlineWeek' ? (label.split(',')[0] ?? label) : label,
      rows: members,
      quantity: members.reduce((sum, row) => sum + row.order.quantity, 0),
    }))
    .sort((a, b) =>
      key === 'deadlineWeek'
        ? (a.rows[0]?.order.deadlineMs ?? 0) - (b.rows[0]?.order.deadlineMs ?? 0)
        : a.label.localeCompare(b.label),
    );
}

/** "2 orders, 900 pcs": a group's count beside its name. */
export function groupCountText(group: OrderGroup): string {
  const orders = group.rows.length === 1 ? '1 order' : `${group.rows.length} orders`;
  return `${orders}, ${quantityText(group.quantity)}`;
}
