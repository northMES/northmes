// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

// The view state of the two order lists in the URL (plan 06, View state in the URL; design ui-222,
// URL keys): the search in q, Late only in late=1, one key per filter field with a comma list of
// the picked values, Group by in group, and the sort as a column id with a leading minus for
// descending. Defaults stay out, and a key that does not apply falls back on its own (ADR 0062).

/** The statuses a production order has in the snapshot. */
export const orderStatusValues = ['planned', 'released'] as const;
export type OrderStatusValue = (typeof orderStatusValues)[number];

/** The token of the status filter of the customer orders list for a line without an order. */
export const notSupplied = 'none';

/** The sortable columns of the production orders list. */
export const orderSortIds = ['order', 'article', 'deadline', 'priority', 'plannedEnd'] as const;
export type OrderSortId = (typeof orderSortIds)[number];

/** The fields the production orders list groups by (design ui-222, LI29; #687, PL3). */
export const orderGroupKeys = ['article', 'customer', 'status', 'deadlineWeek'] as const;
export type OrderGroupKey = (typeof orderGroupKeys)[number];

/** The sortable columns of the customer orders list. */
export const lineSortIds = ['wanted', 'customerOrder', 'customer', 'article'] as const;
export type LineSortId = (typeof lineSortIds)[number];

/** The filter fields the order lists share: the status, the article and the customer. */
export type ListFilterKey = 'status' | 'article' | 'customer';

/** The filter fields of every planning list, the job orders' equipment included (ADR 0091). */
export type AnyListFilterKey = ListFilterKey | 'equipment';

/** A sort in the URL: a column id, with a leading minus for descending. */
export type SortKey<Id extends string> = Id | `-${Id}`;

export interface OrderListSearch {
  readonly q?: string;
  /** 1 keeps the orders late at now. */
  readonly late?: 1;
  readonly status?: readonly OrderStatusValue[];
  readonly article?: readonly string[];
  /** The picked customers by code. */
  readonly customer?: readonly string[];
  readonly group?: OrderGroupKey;
  readonly sort?: SortKey<OrderSortId>;
}

export interface CustomerOrderListSearch {
  readonly q?: string;
  /** 1 keeps the lines whose order is late at now. */
  readonly late?: 1;
  /** The status of the supplying order, or none for a line without one. */
  readonly status?: readonly (OrderStatusValue | typeof notSupplied)[];
  readonly article?: readonly string[];
  readonly customer?: readonly string[];
  readonly sort?: SortKey<LineSortId>;
}

/**
 * A filter key's comma list of picked values, or a validated view's list, each value once. The
 * router parses a lone numeric value, such as an article number, as a number, which reads as its
 * text.
 */
export function commaList<Value extends string>(value: z.ZodType<Value>) {
  return z
    .unknown()
    .transform((raw): Value[] | undefined => {
      const values =
        typeof raw === 'string'
          ? raw.split(',')
          : typeof raw === 'number'
            ? [String(raw)]
            : Array.isArray(raw)
              ? raw
              : [];
      const picked = [...new Set(values.map(String))].filter(
        (each): each is Value => value.safeParse(each).success,
      );
      return picked.length === 0 ? undefined : picked;
    })
    .catch(undefined);
}

/** The search text: trimmed, 1 to 100 characters (ADR 0016). */
export const searchText = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().trim().min(1).max(100))
  .optional()
  .catch(undefined);

/** Late only, as 1. */
export const lateOnlyKey = z
  .union([z.literal(1), z.literal('1'), z.literal(true)])
  .transform(() => 1 as const)
  .optional()
  .catch(undefined);

export function sortKeys<Id extends string>(ids: readonly Id[]) {
  const values = [...ids, ...ids.map((id): `-${Id}` => `-${id}`)] as [
    SortKey<Id>,
    ...SortKey<Id>[],
  ];
  return z.enum(values).optional().catch(undefined);
}

const orderKeys = z.object({
  q: searchText,
  late: lateOnlyKey,
  status: commaList(z.enum(orderStatusValues)),
  article: commaList(z.string().min(1).max(100)),
  customer: commaList(z.string().min(1).max(64)),
  group: z.enum(orderGroupKeys).optional().catch(undefined),
  sort: sortKeys(orderSortIds),
});

const lineKeys = z.object({
  q: searchText,
  late: lateOnlyKey,
  status: commaList(z.enum([...orderStatusValues, notSupplied])),
  article: commaList(z.string().min(1).max(100)),
  customer: commaList(z.string().min(1).max(64)),
  sort: sortKeys(lineSortIds),
});

/** The keys of a parsed view without the undefined ones, so an absent key stays out of the URL. */
export function defined<View extends object>(view: View): View {
  return Object.fromEntries(
    Object.entries(view).filter(([, value]) => value !== undefined),
  ) as View;
}

/** The view of the production orders list a URL's search describes, for validateSearch. */
export function orderListSearch(raw: Record<string, unknown>): OrderListSearch {
  return defined(orderKeys.parse(raw));
}

/** The view of the customer orders list a URL's search describes, for validateSearch. */
export function customerOrderListSearch(raw: Record<string, unknown>): CustomerOrderListSearch {
  return defined(lineKeys.parse(raw));
}

/** A view as the URL holds it: each filter's picked values as a comma list. */
export function urlSearchOf<View extends object>(view: View): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );
}

/** The view with a search text, or without one. */
export function searchedFor<View extends { readonly q?: string }>(view: View, q: string): View {
  const { q: _, ...rest } = view;
  const trimmed = q.trim();
  return (trimmed === '' ? rest : { ...rest, q: trimmed }) as View;
}

/** The view with Late only on or off. */
export function withLateOnly<View extends { readonly late?: 1 }>(view: View, on: boolean): View {
  const { late: _, ...rest } = view;
  return (on ? { ...rest, late: 1 } : rest) as View;
}

/** The view with a filter field's picked values; none drops the field. */
export function filteredBy<View extends object>(
  view: View,
  key: AnyListFilterKey,
  values: readonly string[],
): View {
  const { [key]: _, ...rest } = view as Record<string, unknown>;
  return (values.length === 0 ? rest : { ...rest, [key]: values }) as View;
}

/** The view without its filters; the search, Late only, the grouping and the sort stay. */
export function unfiltered<View extends object>(view: View): View {
  const {
    status: _s,
    article: _a,
    customer: _c,
    equipment: _e,
    ...rest
  } = view as Record<string, unknown>;
  return rest as View;
}

export function isFiltered(view: OrderListSearch | CustomerOrderListSearch): boolean {
  return view.status !== undefined || view.article !== undefined || view.customer !== undefined;
}

/** The production orders view grouped by a field, or not grouped. */
export function groupedBy<View extends { readonly group?: string }>(
  view: View,
  group: View['group'] | undefined,
): View {
  const { group: _, ...rest } = view;
  return (group === undefined ? rest : { ...rest, group }) as View;
}

/** The column and direction of a view's sort, or the list's default without a key. */
export function sortOf<Id extends string>(
  view: { readonly sort?: SortKey<Id> },
  fallback: Id,
): { readonly id: Id; readonly desc: boolean } {
  const sort: SortKey<Id> | undefined = view.sort;
  if (sort === undefined) return { id: fallback, desc: false };
  return sort.startsWith('-')
    ? { id: sort.slice(1) as Id, desc: true }
    : { id: sort as Id, desc: false };
}

/** The view sorted on a column; the default, ascending on the fallback column, leaves the key out. */
export function sortedBy<View extends { readonly sort?: SortKey<Id> }, Id extends string>(
  view: View,
  sort: { readonly id: string; readonly desc: boolean },
  fallback: Id,
): View {
  const { sort: _, ...rest } = view;
  if (sort.id === fallback && !sort.desc) return rest as View;
  return { ...rest, sort: sort.desc ? `-${sort.id}` : sort.id } as View;
}
