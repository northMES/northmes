// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { companies, equipment, fakeApi, renderShellAt, viewer } from './settings-fixtures.tsx';

/** The ResizeObservers the page made, with the elements each observes. */
const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];

/** A ResizeObserver whose resizes the test sends. */
class FakeResizeObserver {
  readonly targets: Element[] = [];
  constructor(callback: ResizeObserverCallback) {
    observers.push({ callback, targets: this.targets });
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.targets.length = 0;
  }
}

/** Resizes the element to this height, as the browser reports it to its observers. */
function resize(element: Element, blockSize: number) {
  for (const { callback, targets } of observers) {
    if (!targets.includes(element)) continue;
    const entry = {
      target: element,
      borderBoxSize: [{ blockSize, inlineSize: 1440 }],
      contentRect: { height: blockSize },
    } as unknown as ResizeObserverEntry;
    callback([entry], {} as ResizeObserver);
  }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  observers.length = 0;
});

function renderAt(path: string) {
  const api = fakeApi({ CoreCompanies: companies, CoreViewer: () => viewer([], []) });
  return renderShellAt(path, [equipment], { fetch: api.fetch });
}

describe('focus not obscured', () => {
  it('E04-S02 the page scrolls a focused control to 8 px under the sticky top bar, measured as the bar grows (D2 KE19, KE20)', async () => {
    renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    const topBar = screen.getByRole('banner');

    resize(topBar, 56);
    expect(document.documentElement.style.scrollPaddingTop).toBe('64px');
    resize(topBar, 100);
    expect(document.documentElement.style.scrollPaddingTop).toBe('108px');

    cleanup();
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
  });
});
