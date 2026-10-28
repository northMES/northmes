// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/**
 * A customer order's page in the URL (design #728): its open tab, General unless tab says History,
 * and supply, the line whose Supply from an order step is open (KO3).
 */
export interface CustomerOrderPageSearch {
  readonly tab?: 'history';
  readonly supply?: number;
}

/** The URL search of a customer order's page, for its route's validateSearch; a bad key falls back. */
export function customerOrderPageSearch(raw: Record<string, unknown>): CustomerOrderPageSearch {
  // An integer or a string of digits names a line; anything else, true or a list, falls back.
  const supply = z
    .union([
      z.number().int(),
      z
        .string()
        .regex(/^\d{1,4}$/)
        .transform(Number),
    ])
    .pipe(z.number().positive().max(9999))
    .optional()
    .catch(undefined)
    .parse(raw.supply);
  return {
    ...(raw.tab === 'history' && { tab: 'history' as const }),
    ...(supply !== undefined && { supply }),
  };
}
