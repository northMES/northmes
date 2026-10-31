// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useState } from 'react';
import { widthWithin } from '../../components/column-resizer/index.ts';

const storageKey = 'northmes.planning.board.machine-column';

/**
 * The machine column's width before the planner resizes it: 200 px or 40 percent of the grid,
 * whichever is less (plan 07), and never under the least width.
 */
const defaultPx = 200;
const defaultShare = 0.4;

/** The least width the machine column keeps, which holds its header's two lines. */
export const machineColumnMinPx = 140;

/** The least the time area keeps beside it. */
const timeMinPx = 160;

/** The machine column's bounds at a grid width: what a resize may make it. */
export function machineColumnBounds(gridWidth: number): { min: number; max: number } {
  return {
    min: machineColumnMinPx,
    max: Math.max(machineColumnMinPx, Math.floor(gridWidth - timeMinPx)),
  };
}

/**
 * The machine column's width at a grid width, from the width the planner kept or else the default,
 * within the bounds a resize keeps.
 */
export function machineColumnWidth(gridWidth: number, kept: number | undefined): number {
  const { min, max } = machineColumnBounds(gridWidth);
  return widthWithin(kept ?? Math.min(defaultPx, Math.floor(gridWidth * defaultShare)), min, max);
}

function stored(): number | undefined {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    const width =
      typeof parsed === 'object' && parsed !== null ? (parsed as { width?: unknown }).width : null;
    return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The machine column's width the planner gave it by its header edge (#943), kept per browser like
 * the Gantt's options, and a setter that keeps a change. A browser without storage keeps it for
 * the page alone.
 */
export function useMachineColumnWidth(): [number | undefined, (width: number) => void] {
  const [width, setWidth] = useState(stored);
  // The write to storage stays outside the state updater, which React may run more than once.
  const change = (next: number) => {
    setWidth(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ width: next }));
    } catch {
      // The width holds until the page closes.
    }
  };
  return [width, change];
}
