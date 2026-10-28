// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/**
 * A page state the product owner can open on mock data (#762, BF10 to BF13): loading, could not
 * load, no access, and both lists set and empty. A server source ignores it.
 */
export type BoardFieldsPreview = 'loading' | 'empty' | 'error' | 'forbidden';

/** The URL keys of the board fields page: only the preview; an unknown value falls back to none. */
export interface BoardFieldsSearch {
  readonly preview?: BoardFieldsPreview;
}

const preview = z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined);

export function boardFieldsSearch(raw: Record<string, unknown>): BoardFieldsSearch {
  const parsed = preview.parse(raw.preview);
  return parsed === undefined ? {} : { preview: parsed };
}
