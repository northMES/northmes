// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewportFill } from '../../../src/modules/planning/use-grid-size.ts';

afterEach(() => vi.unstubAllGlobals());

describe('useViewportFill (plan 18, phase 1 findings)', () => {
  it('#939 measures again when the page around the grid changes height, as when the title row wraps', () => {
    // The page frame: its title row holds the bar and the status line, its region the grid.
    const page = document.createElement('div');
    const titleRow = document.createElement('div');
    const region = document.createElement('div');
    const fill = document.createElement('div');
    page.append(titleRow, region);
    region.append(fill);
    document.body.append(page);
    const observers: { callback: ResizeObserverCallback; observed: Element[] }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly observed: Element[] = [];
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback, observed: this.observed });
        }
        observe(target: Element) {
          this.observed.push(target);
        }
        disconnect() {}
        unobserve() {}
      },
    );
    let top = 100;
    fill.getBoundingClientRect = () => ({ top }) as DOMRect;
    const { result } = renderHook(() => useViewportFill('key'));
    act(() => result.current[1](fill));
    expect(result.current[0]).toBe(window.innerHeight - 100);

    // The status line wraps: the grid moves down, the region keeps its size, the page grows.
    top = 124;
    const watching = observers.find((each) => each.observed.includes(page));
    act(() => watching?.callback([], {} as ResizeObserver));

    expect(result.current[0]).toBe(window.innerHeight - 124);
    page.remove();
  });
});
