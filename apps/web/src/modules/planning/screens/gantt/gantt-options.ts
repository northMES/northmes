// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useState } from 'react';

/**
 * The local options of the order Gantt (plan 18, Settings, options and permissions): kept per
 * browser like the theme, never in the URL. A browser without storage keeps them for the page
 * alone.
 */
export interface GanttOptions {
  /** Hide closed time: nights, breaks and weekends compressed to a gap, on by default (ADR 0030). */
  readonly hideClosed: boolean;
  /** The ids of the tree columns the Columns menu hides. */
  readonly hiddenColumns: readonly string[];
  /** The workload panel under the time area. */
  readonly workload: boolean;
  /** Cascade after a move (plan 18, Cascade rule 1): on by default, the choice stays local. */
  readonly cascade: boolean;
  /** The share of the view the tree pane takes, which its splitter sets (#943). */
  readonly treePaneShare: number;
  /** The widths the planner gave tree columns by their header edge, by column id (#943). */
  readonly columnWidths: Readonly<Record<string, number>>;
}

const storageKey = 'northmes.planning.gantt.options';

/**
 * The columns hidden by default: Name, Deadline and Float show, as the D5 frames draw them (the
 * row names already carry the machine and the span, and Late by sits in the Name cell); the rest
 * sit in the Columns menu.
 */
export const defaultHiddenColumns: readonly string[] = [
  'machine',
  'quantity',
  'start',
  'end',
  'workingTime',
  'lateBy',
  'status',
  'lock',
];

export const defaultOptions: GanttOptions = {
  hideClosed: true,
  hiddenColumns: defaultHiddenColumns,
  workload: false,
  cascade: true,
  treePaneShare: 0.4,
  columnWidths: {},
};

/** A kept share of the view between 0 and 1; the screen fits it to the view's width. */
function shareOf(value: unknown): number {
  return typeof value === 'number' && value > 0 && value < 1 ? value : defaultOptions.treePaneShare;
}

/** The kept column widths that are positive numbers; the screen fits each to its column. */
function widthsOf(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
    ),
  );
}

function stored(): GanttOptions {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return defaultOptions;
    const options = parsed as Partial<Record<keyof GanttOptions, unknown>>;
    return {
      hideClosed: options.hideClosed !== false,
      hiddenColumns: Array.isArray(options.hiddenColumns)
        ? options.hiddenColumns.filter((id): id is string => typeof id === 'string')
        : defaultHiddenColumns,
      workload: options.workload === true,
      cascade: options.cascade !== false,
      treePaneShare: shareOf(options.treePaneShare),
      columnWidths: widthsOf(options.columnWidths),
    };
  } catch {
    return defaultOptions;
  }
}

/** The options this browser kept, and a setter that keeps a change. */
export function useGanttOptions(): [GanttOptions, (change: Partial<GanttOptions>) => void] {
  const [options, setOptions] = useState(stored);
  // The write to storage stays outside the state updater, which React may run more than once.
  const change = (next: Partial<GanttOptions>) => {
    const merged = { ...options, ...next };
    setOptions(merged);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(merged));
    } catch {
      // The choice holds until the page closes.
    }
  };
  return [options, change];
}
