// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { WarehousesPreview } from './warehouses-data.ts';

/**
 * The URL keys of the warehouses register (ADR 0062; design #729): the search in q, the Plant
 * filter as a comma list of plant slugs, Not mapped only in unmapped=1, and preview, the page state
 * the mock source answers with (WH3 to WH6). Defaults stay out; a key that does not apply falls
 * back on its own.
 */
export interface WarehouseListSearch {
  readonly q?: string;
  readonly plant?: readonly string[];
  readonly unmapped?: 1;
  readonly preview?: WarehousesPreview;
}

const keys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  plant: z
    .unknown()
    .transform((raw): string[] | undefined => {
      const values = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [];
      const picked = [...new Set(values.map(String))].filter((each) =>
        /^[a-z0-9-]{1,64}$/.test(each),
      );
      return picked.length === 0 ? undefined : picked;
    })
    .catch(undefined),
  unmapped: z
    .union([z.literal(1), z.literal('1'), z.literal(true)])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
  preview: z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined),
});

export function warehouseListSearch(raw: Record<string, unknown>): WarehouseListSearch {
  return Object.fromEntries(
    Object.entries(keys.parse(raw)).filter(([, value]) => value !== undefined),
  ) as WarehouseListSearch;
}

/** A view as the URL holds it: the picked plants as a comma list. */
export function urlSearchOf(view: WarehouseListSearch): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );
}
