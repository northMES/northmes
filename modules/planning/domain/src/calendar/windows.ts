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

/** Where work lies once laid over availability: its span and its working segments. */
export interface Placement {
  readonly startMs: number;
  readonly endMs: number;
  /** The open windows the work occupies, in order; empty for zero work. */
  readonly segments: readonly Window[];
}

/**
 * Work laid forward from an instant (ADR 0025 rule 10): it starts at the first working instant at
 * or after `fromMs` and fills the windows in order. Null when the windows run out before the work
 * does, which tells the caller to expand the horizon and try again.
 */
export function addWork(windows: Windows, fromMs: number, workS: number): Placement | null {
  let remainingMs = Math.round(workS * 1000);
  const segments: Window[] = [];
  let startMs: number | undefined;
  for (const window of windows) {
    if (window.toMs <= fromMs) continue;
    const segmentFrom = Math.max(window.fromMs, fromMs);
    startMs ??= segmentFrom;
    if (remainingMs <= 0) break;
    const take = Math.min(remainingMs, window.toMs - segmentFrom);
    segments.push({ fromMs: segmentFrom, toMs: segmentFrom + take });
    remainingMs -= take;
    if (remainingMs <= 0) break;
  }
  if (startMs === undefined || remainingMs > 0) return null;
  const last = segments[segments.length - 1];
  return { startMs, endMs: last === undefined ? startMs : last.toMs, segments };
}

/**
 * Work laid backward from an instant: it ends at the last working instant at or before `untilMs`
 * and fills the windows in reverse order. Null when the windows run out before the work does.
 */
export function subtractWork(windows: Windows, untilMs: number, workS: number): Placement | null {
  let remainingMs = Math.round(workS * 1000);
  const segments: Window[] = [];
  let endMs: number | undefined;
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const window = windows[index];
    if (window === undefined || window.fromMs >= untilMs) continue;
    const segmentTo = Math.min(window.toMs, untilMs);
    endMs ??= segmentTo;
    if (remainingMs <= 0) break;
    const take = Math.min(remainingMs, segmentTo - window.fromMs);
    segments.unshift({ fromMs: segmentTo - take, toMs: segmentTo });
    remainingMs -= take;
    if (remainingMs <= 0) break;
  }
  if (endMs === undefined || remainingMs > 0) return null;
  const first = segments[0];
  return { startMs: first === undefined ? endMs : first.fromMs, endMs, segments };
}

/** The working seconds inside [fromMs, toMs); zero when the span is empty or inverted. */
export function workBetween(windows: Windows, fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  let ms = 0;
  for (const window of windows) {
    if (window.toMs <= fromMs) continue;
    if (window.fromMs >= toMs) break;
    ms += Math.min(window.toMs, toMs) - Math.max(window.fromMs, fromMs);
  }
  return ms / 1000;
}

/**
 * The first working instant at or after an instant: the forward snap of plan 18, so a drop in a
 * break lands at the break's end. Null past the last window.
 */
export function nextWorkingInstant(windows: Windows, atMs: number): number | null {
  for (const window of windows) {
    if (window.toMs <= atMs) continue;
    return Math.max(window.fromMs, atMs);
  }
  return null;
}
