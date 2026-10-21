// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { ToolsPreview } from './tools-data.ts';

/**
 * The URL keys of the tools register (ADR 0062; design #729): the search in q, Scope (company or
 * plant), Source (the ERP, the import or NorthMES), Not used only in unused=1, and preview, the page
 * state the mock source answers with (TO5 to TO8). Defaults stay out; a key that does not apply
 * falls back on its own.
 */
export interface ToolListSearch {
  readonly q?: string;
  readonly scope?: 'company' | 'plant';
  readonly source?: 'erp' | 'import' | 'northmes';
  readonly unused?: 1;
  readonly preview?: ToolsPreview;
}

const keys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  scope: z.enum(['company', 'plant']).optional().catch(undefined),
  source: z.enum(['erp', 'import', 'northmes']).optional().catch(undefined),
  unused: z
    .union([z.literal(1), z.literal('1'), z.literal(true)])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
  preview: z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined),
});

export function toolListSearch(raw: Record<string, unknown>): ToolListSearch {
  return Object.fromEntries(
    Object.entries(keys.parse(raw)).filter(([, value]) => value !== undefined),
  ) as ToolListSearch;
}
