// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useState } from 'react';

/**
 * The local options of the order Gantt (plan 18, Settings, options and permissions): kept per
 * browser like the theme, never in the URL. A browser without storage keeps them for the page
 * alone.
 */
export interface GanttOptions {
  /** Hide closed time: nights, breaks and weekends compressed to a gap (off until ADR 0030 is amended). */
  readonly hideClosed: boolean;
  /** The ids of the tree columns the Columns menu hides. */
  readonly hiddenColumns: readonly string[];
  /** The workload panel under the time area. */
  readonly workload: boolean;
}

const storageKey = 'northmes.planning.gantt.options';

/** The columns hidden by default: the seven of plan 18 show, the rest sit in the Columns menu. */
export const defaultHiddenColumns: readonly string[] = [
  'quantity',
  'workingTime',
  'status',
  'lock',
];

export const defaultOptions: GanttOptions = {
  hideClosed: false,
  hiddenColumns: defaultHiddenColumns,
  workload: false,
};

function stored(): GanttOptions {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return defaultOptions;
    const options = parsed as Partial<Record<keyof GanttOptions, unknown>>;
    return {
      hideClosed: options.hideClosed === true,
      hiddenColumns: Array.isArray(options.hiddenColumns)
        ? options.hiddenColumns.filter((id): id is string => typeof id === 'string')
        : defaultHiddenColumns,
      workload: options.workload === true,
    };
  } catch {
    return defaultOptions;
  }
}

/** The options this browser kept, and a setter that keeps a change. */
export function useGanttOptions(): [GanttOptions, (change: Partial<GanttOptions>) => void] {
  const [options, setOptions] = useState(stored);
  const change = (next: Partial<GanttOptions>) => {
    setOptions((current) => {
      const merged = { ...current, ...next };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {
        // The choice holds until the page closes.
      }
      return merged;
    });
  };
  return [options, change];
}
