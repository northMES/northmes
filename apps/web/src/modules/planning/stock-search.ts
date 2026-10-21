// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { InventoryPreview } from './inventory-data.ts';

// The view state of the Stock page and the stock of one article in the URL (ADR 0062; design
// #729): the search in q, the Warehouse and Kind of article filters as comma lists, Below zero
// only in below=1, the list's sort as a column id with a leading minus for descending, and
// preview, the page state the mock source answers with. Defaults stay out, and a key that does
// not apply falls back on its own.

/** The sortable columns of the Stock page; without one the page sorts materials first, by lowest. */
export const stockSortIds = ['article', 'lowest'] as const;
export type StockSortId = (typeof stockSortIds)[number];

export type ArticleKind = 'material' | 'finished';

export interface StockSearch {
  readonly q?: string;
  /** The picked warehouses by code; none counts every warehouse mapped to the plant. */
  readonly warehouse?: readonly string[];
  readonly kind?: readonly ArticleKind[];
  /** 1 keeps the articles whose projection falls below zero. */
  readonly below?: 1;
  readonly sort?: StockSortId | `-${StockSortId}`;
  readonly preview?: InventoryPreview;
}

export interface StockArticleSearch {
  readonly preview?: InventoryPreview;
}

const text = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().trim().min(1).max(100))
  .optional()
  .catch(undefined);

/** A filter key's comma list of picked values, each value once; an invalid one drops out. */
function commaList<Value extends string>(accepts: (value: string) => value is Value) {
  return z
    .unknown()
    .transform((raw): Value[] | undefined => {
      const values =
        typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw.map(String) : [];
      const picked = [...new Set(values)].filter(accepts);
      return picked.length === 0 ? undefined : picked;
    })
    .catch(undefined);
}

const preview = z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined);

const code = (value: string): value is string => /^[A-Za-z0-9-]{1,32}$/.test(value);
const kind = (value: string): value is ArticleKind => value === 'material' || value === 'finished';

const sort = z
  .string()
  .refine((value) => (stockSortIds as readonly string[]).includes(value.replace(/^-/, '')))
  .transform((value) => value as StockSortId | `-${StockSortId}`)
  .optional()
  .catch(undefined);

/** The keys of a parsed view without the undefined ones, so an absent key stays out of the URL. */
function defined<View extends object>(view: View): View {
  return Object.fromEntries(
    Object.entries(view).filter(([, value]) => value !== undefined),
  ) as View;
}

export function stockSearch(raw: Record<string, unknown>): StockSearch {
  return defined(
    z
      .object({
        q: text,
        warehouse: commaList(code),
        kind: commaList(kind),
        below: z
          .union([z.literal(1), z.literal('1'), z.literal(true)])
          .transform(() => 1 as const)
          .optional()
          .catch(undefined),
        sort,
        preview,
      })
      .parse(raw),
  );
}

export function stockArticleSearch(raw: Record<string, unknown>): StockArticleSearch {
  const parsed = preview.parse(raw.preview);
  return parsed === undefined ? {} : { preview: parsed };
}

/** A view as the URL holds it: each filter's picked values as a comma list. */
export function urlSearchOf(view: StockSearch): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );
}
