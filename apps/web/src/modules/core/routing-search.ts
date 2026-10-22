// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { RoutingsPreview } from './routings-data.ts';

/** The URL keys of the routing pages: preview, the page state the mock source answers with. */
export interface RoutingPageSearch {
  readonly preview?: RoutingsPreview;
}

const preview = z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined);

export function routingPageSearch(raw: Record<string, unknown>): RoutingPageSearch {
  const parsed = preview.parse(raw.preview);
  return parsed === undefined ? {} : { preview: parsed };
}
