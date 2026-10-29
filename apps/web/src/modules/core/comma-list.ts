// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/** The scope of a tool or an equipment group: the company's, so every plant may use it, or one plant's. */
export type Scope = 'company' | 'plant';

/**
 * A filter key's comma list of picked values from a known set, each value once; an unknown value
 * drops out, and an empty list stays out of the view (ADR 0062). The tools and the equipment
 * groups registers parse their Scope key with it.
 */
export function commaList<Value extends string>(values: readonly Value[]) {
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
