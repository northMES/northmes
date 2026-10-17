// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Half-open windows of time in epoch milliseconds, [fromMs, toMs), the shape availability takes
// (ADR 0025): sorted, disjoint and never empty. Every function here is plain integer arithmetic
// over such lists, so autoplan, the board and the server lay work over a calendar the same way.

/** A span of time, [fromMs, toMs). */
export interface Window {
  readonly fromMs: number;
  readonly toMs: number;
}

/** Sorted, disjoint, non-empty windows: the availability of a machine. */
export type Windows = readonly Window[];

/**
 * The windows as a sorted, disjoint list: empty and inverted spans dropped, overlapping and
 * touching ones merged. Every other function assumes its input has this shape.
 */
export function normalizeWindows(windows: readonly Window[]): Window[] {
  const sorted = windows
    .filter((window) => window.toMs > window.fromMs)
    .sort((a, b) => a.fromMs - b.fromMs || a.toMs - b.toMs);
  const merged: Window[] = [];
  for (const window of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && window.fromMs <= last.toMs) {
      if (window.toMs > last.toMs) merged[merged.length - 1] = { fromMs: last.fromMs, toMs: window.toMs };
    } else {
      merged.push({ fromMs: window.fromMs, toMs: window.toMs });
    }
  }
  return merged;
}

/** The time in either list. */
export function unionWindows(a: readonly Window[], b: readonly Window[]): Window[] {
  return normalizeWindows([...a, ...b]);
}

/** The time in `a` that is not in `b`. */
export function subtractWindows(a: readonly Window[], b: readonly Window[]): Window[] {
  const holes = normalizeWindows(b);
  const result: Window[] = [];
  for (const window of normalizeWindows(a)) {
    let cursor = window.fromMs;
    for (const hole of holes) {
      if (hole.toMs <= cursor) continue;
      if (hole.fromMs >= window.toMs) break;
      if (hole.fromMs > cursor) result.push({ fromMs: cursor, toMs: hole.fromMs });
      cursor = Math.max(cursor, hole.toMs);
    }
    if (cursor < window.toMs) result.push({ fromMs: cursor, toMs: window.toMs });
  }
  return result;
}

/** The part of the windows inside [fromMs, toMs). */
export function clipWindows(windows: Windows, fromMs: number, toMs: number): Window[] {
  const clipped: Window[] = [];
  for (const window of windows) {
    if (window.toMs <= fromMs) continue;
    if (window.fromMs >= toMs) break;
    clipped.push({ fromMs: Math.max(window.fromMs, fromMs), toMs: Math.min(window.toMs, toMs) });
  }
  return clipped;
}
