// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { ToolsPreview } from './tools-data.ts';

/**
 * The URL keys of the tools register (ADR 0062; design #729): the search in q, Scope (company or
 * plant) and Source (the ERP, the import or NorthMES) as comma lists, Not used only in unused=1, and preview, the page
 * state the mock source answers with (TO5 to TO8). Defaults stay out; a key that does not apply
 * falls back on its own.
 */
export type ToolScope = 'company' | 'plant';
export type ToolSource = 'erp' | 'import' | 'northmes';

export interface ToolListSearch {
  readonly q?: string;
  readonly scope?: readonly ToolScope[];
  readonly source?: readonly ToolSource[];
  readonly unused?: 1;
  readonly preview?: ToolsPreview;
}

/** A filter key's comma list of picked values, each value once; an unknown value drops out. */
function commaList<Value extends string>(values: readonly Value[]) {
  return z
    .unknown()
    .transform((raw): Value[] | undefined => {
      const given = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [];
      const picked = [...new Set(given.map(String))].filter((each): each is Value =>
        (values as readonly string[]).includes(each),
      );
      return picked.length === 0 ? undefined : picked;
    })
    .catch(undefined);
}

const preview = z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined);

const keys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  scope: commaList(['company', 'plant'] as const),
  source: commaList(['erp', 'import', 'northmes'] as const),
  unused: z
    .union([z.literal(1), z.literal('1'), z.literal(true)])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
  preview,
});

export function toolListSearch(raw: Record<string, unknown>): ToolListSearch {
  return Object.fromEntries(
    Object.entries(keys.parse(raw)).filter(([, value]) => value !== undefined),
  ) as ToolListSearch;
}

/** A view as the URL holds it: each filter's picked values as a comma list. */
export function urlSearchOf(view: ToolListSearch): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );
}

/** The URL keys of a tool's page: preview, the page state the mock source answers with. */
export function toolPageSearch(raw: Record<string, unknown>): { readonly preview?: ToolsPreview } {
  const parsed = preview.parse(raw.preview);
  return parsed === undefined ? {} : { preview: parsed };
}
