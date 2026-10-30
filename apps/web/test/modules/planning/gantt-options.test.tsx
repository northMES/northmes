// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  defaultHiddenColumns,
  useGanttOptions,
} from '../../../src/modules/planning/screens/gantt/gantt-options.ts';

const storageKey = 'northmes.planning.gantt.options';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('useGanttOptions', () => {
  it('starts with Hide closed time and cascade on, the default columns and the workload panel closed', () => {
    const { result } = renderHook(() => useGanttOptions());
    expect(result.current[0]).toEqual({
      hideClosed: true,
      hiddenColumns: defaultHiddenColumns,
      workload: false,
      cascade: true,
      treePaneShare: 0.4,
    });
  });

  it('#943 keeps the tree pane share within 10 and 90 percent of the view', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ treePaneShare: 0.55 }));
    expect(renderHook(() => useGanttOptions()).result.current[0].treePaneShare).toBe(0.55);
    cleanup();
    window.localStorage.setItem(storageKey, JSON.stringify({ treePaneShare: 3 }));
    expect(renderHook(() => useGanttOptions()).result.current[0].treePaneShare).toBe(0.4);
    cleanup();
    window.localStorage.setItem(storageKey, JSON.stringify({ treePaneShare: 'wide' }));
    expect(renderHook(() => useGanttOptions()).result.current[0].treePaneShare).toBe(0.4);
  });

  it('keeps a browser that turned Hide closed time off', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ hideClosed: false, cascade: false }));
    const { result } = renderHook(() => useGanttOptions());
    expect(result.current[0].hideClosed).toBe(false);
    expect(result.current[0].cascade).toBe(false);
    expect(result.current[0].hiddenColumns).toEqual(defaultHiddenColumns);
  });

  it('writes a change to storage and reads it back', () => {
    const { result } = renderHook(() => useGanttOptions());
    act(() => result.current[1]({ hideClosed: false, workload: true }));
    expect(result.current[0]).toMatchObject({ hideClosed: false, workload: true });
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')).toMatchObject({
      hideClosed: false,
      workload: true,
    });
  });

  it('falls back to the defaults when storage holds something else', () => {
    window.localStorage.setItem(storageKey, '"not an object"');
    const { result } = renderHook(() => useGanttOptions());
    expect(result.current[0].hideClosed).toBe(true);
  });
});
