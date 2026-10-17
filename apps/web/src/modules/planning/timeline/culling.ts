// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/** Something with a span on the axis: a block, a bucket or a marker band. */
export interface Spanned {
  readonly fromMs: number;
  readonly toMs: number;
}

/** The index of the first item whose `key` is greater than `value`, by binary search. */
function firstAbove<T>(items: readonly T[], value: number, key: (item: T) => number): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const item = items[mid];
    if (item !== undefined && key(item) <= value) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * The slice [from, to) of items that touch a visible range, by binary search over items sorted by
 * start that do not overlap each other, as a row's blocks and a lane's buckets are (plan 18,
 * Shared pieces). With no overlap the ends are sorted too, so the first visible item is the first
 * whose end lies after the range start, and the last is the last whose start lies before its end.
 */
export function visibleSlice(
  items: readonly Spanned[],
  range: { readonly fromMs: number; readonly toMs: number },
): { readonly from: number; readonly to: number } {
  const from = firstAbove(items, range.fromMs, (item) => item.toMs);
  const to = firstAbove(items, range.toMs - 1, (item) => item.fromMs);
  return { from, to: Math.max(from, to) };
}

/** The items of the visible slice. */
export function visibleItems<T extends Spanned>(
  items: readonly T[],
  range: { readonly fromMs: number; readonly toMs: number },
): T[] {
  const { from, to } = visibleSlice(items, range);
  return items.slice(from, to);
}
