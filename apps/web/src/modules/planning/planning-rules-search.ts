// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/**
 * A page state the product owner can open on mock data (#766, PS5 to PS7): loading, could not
 * load and no access. A server source ignores it.
 */
export type PlanningRulesPreview = 'loading' | 'error' | 'forbidden';

/** The URL keys of the planning rules page: only the preview; an unknown value falls back to none. */
export interface PlanningRulesSearch {
  readonly preview?: PlanningRulesPreview;
}

const preview = z.enum(['loading', 'error', 'forbidden']).optional().catch(undefined);

export function planningRulesSearch(raw: Record<string, unknown>): PlanningRulesSearch {
  const parsed = preview.parse(raw.preview);
  return parsed === undefined ? {} : { preview: parsed };
}
