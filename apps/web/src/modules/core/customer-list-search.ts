// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { CustomerOwner, CustomersPreview } from './customers-data.ts';

// The view state of the customers list and a customer's page in the URL (ADR 0062; design #728):
// the search in q, the Source filter as a comma list of owners, With late lines and Late only in
// late=1, With lines not supplied and Not supplied in unsupplied=1, the list's sort as a column id
// with a leading minus for descending, a customer's open tab in tab, and preview, the page state
// the mock source answers with. Defaults stay out, and a key that does not apply falls back on its
// own.

/** The sortable columns of the customers list. */
export const customerSortIds = [
  'name',
  'code',
  'lines',
  'orders',
  'late',
  'notSupplied',
  'nextWanted',
] as const;
export type CustomerSortId = (typeof customerSortIds)[number];

export interface CustomerListSearch {
  readonly q?: string;
  readonly source?: readonly CustomerOwner[];
  /** 1 keeps the customers with a late line. */
  readonly late?: 1;
  /** 1 keeps the customers with a line that no production order supplies. */
  readonly unsupplied?: 1;
  readonly sort?: CustomerSortId | `-${CustomerSortId}`;
  readonly preview?: CustomersPreview;
}

export interface CustomerPageSearch {
  readonly q?: string;
  /** 1 keeps the lines whose supplying order is late. */
  readonly late?: 1;
  /** 1 keeps the lines that no production order supplies. */
  readonly unsupplied?: 1;
  /** The open tab; General, the default, stays out. */
  readonly tab?: 'history';
  readonly preview?: CustomersPreview;
}

const text = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().trim().min(1).max(100))
  .optional()
  .catch(undefined);

const flag = z
  .union([z.literal(1), z.literal('1'), z.literal(true)])
  .transform(() => 1 as const)
  .optional()
  .catch(undefined);

const preview = z.enum(['loading', 'empty', 'error']).optional().catch(undefined);

const owners = z
  .unknown()
  .transform((raw): CustomerOwner[] | undefined => {
    const values = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [];
    const picked = [...new Set(values.map(String))].filter(
      (each): each is CustomerOwner => each === 'erp' || each === 'northmes',
    );
    return picked.length === 0 ? undefined : picked;
  })
  .catch(undefined);

const sort = z
  .string()
  .refine((value) => (customerSortIds as readonly string[]).includes(value.replace(/^-/, '')))
  .transform((value) => value as CustomerSortId | `-${CustomerSortId}`)
  // The default sort, by name ascending, stays out of the URL.
  .refine((value) => value !== 'name')
  .optional()
  .catch(undefined);

/** The keys of a parsed view without the undefined ones, so an absent key stays out of the URL. */
function defined<View extends object>(view: View): View {
  return Object.fromEntries(
    Object.entries(view).filter(([, value]) => value !== undefined),
  ) as View;
}

export function customerListSearch(raw: Record<string, unknown>): CustomerListSearch {
  return defined(
    z
      .object({
        q: text,
        source: owners,
        late: flag,
        unsupplied: flag,
        sort,
        preview,
      })
      .parse(raw),
  );
}

export function customerPageSearch(raw: Record<string, unknown>): CustomerPageSearch {
  return defined(
    z
      .object({
        q: text,
        late: flag,
        unsupplied: flag,
        tab: z.literal('history').optional().catch(undefined),
        preview,
      })
      .parse(raw),
  );
}

/** A view as the URL holds it: the Source filter's picked owners as a comma list. */
export function urlSearchOf(
  view: CustomerListSearch | CustomerPageSearch,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );
}

/** The list's sort as a column and a direction; by name ascending when the URL names none. */
export function sortOf(view: CustomerListSearch): {
  readonly id: CustomerSortId;
  readonly desc: boolean;
} {
  const key = view.sort ?? 'name';
  return { id: key.replace(/^-/, '') as CustomerSortId, desc: key.startsWith('-') };
}

/** The view sorted on a column, the default sort leaving the URL. */
export function sortedBy(
  view: CustomerListSearch,
  next: { readonly id: string; readonly desc: boolean },
): CustomerListSearch {
  const { sort: _, ...rest } = view;
  const id = next.id as CustomerSortId;
  if (id === 'name' && !next.desc) return rest;
  return { ...rest, sort: next.desc ? `-${id}` : id };
}
