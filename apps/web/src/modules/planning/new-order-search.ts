// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/**
 * A page state the product owner can open on mock data (#768, NO6 to NO9 and NC4 to NC7):
 * loading, empty (no article, or no customer), could not load and no access. A server source
 * ignores it.
 */
export type NewOrderPreview = 'loading' | 'empty' | 'error' | 'forbidden';

/** The URL keys of New production order: the customer order line it starts from, and the preview. */
export interface NewOrderSearch {
  /** The id of a customer order line, such as 40211-2, whose article, quantity and date it takes. */
  readonly line?: string;
  readonly preview?: NewOrderPreview;
}

/** The URL keys of New customer order: the preview. */
export interface NewCustomerOrderSearch {
  readonly preview?: NewOrderPreview;
}

const preview = z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined);
const line = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/^[\w-]{1,40}$/))
  .optional()
  .catch(undefined);

export function newOrderSearch(raw: Record<string, unknown>): NewOrderSearch {
  const fromLine = line.parse(raw.line);
  const previewed = preview.parse(raw.preview);
  return {
    ...(fromLine !== undefined && { line: fromLine }),
    ...(previewed !== undefined && { preview: previewed }),
  };
}

export function newCustomerOrderSearch(raw: Record<string, unknown>): NewCustomerOrderSearch {
  const previewed = preview.parse(raw.preview);
  return previewed === undefined ? {} : { preview: previewed };
}
