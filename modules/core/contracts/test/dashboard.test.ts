// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { dashboardLayout, dashboardWidget, saveDashboardTab } from '../src/dashboard.ts';

/** A List widget at the top left, with the overrides. */
function list(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    type: 'list',
    size: 'medium',
    x: 0,
    y: 0,
    settings: { title: 'Production orders, Milling' },
    ...overrides,
  };
}

describe('dashboardWidget (design shell-454)', () => {
  it('takes a widget of an allowed size that fits the 12 columns', () => {
    expect(dashboardWidget.safeParse(list({ size: 'tall', x: 6 })).success).toBe(true);
  });

  it('refuses a size its type does not allow', () => {
    const result = dashboardWidget.safeParse(list({ type: 'value', size: 'wide' }));

    expect(result.error?.issues.map(({ path }) => path)).toEqual([['size']]);
  });

  it('refuses a widget that reaches past the 12th column', () => {
    const result = dashboardWidget.safeParse(list({ size: 'large', x: 8 }));

    expect(result.error?.issues.map(({ path }) => path)).toEqual([['x']]);
  });

  it('refuses an unknown type and an empty title', () => {
    expect(dashboardWidget.safeParse(list({ type: 'gauge' })).success).toBe(false);
    expect(dashboardWidget.safeParse(list({ settings: { title: ' ' } })).success).toBe(false);
  });
});

describe('dashboardLayout (design shell-454)', () => {
  it('takes widgets that do not overlap', () => {
    const layout = [list(), list({ id: 'w2', x: 4 }), list({ id: 'w3', y: 4 })];

    expect(dashboardLayout.safeParse(layout).success).toBe(true);
  });

  it('refuses two widgets that cover one cell, naming the second', () => {
    const result = dashboardLayout.safeParse([list(), list({ id: 'w2', x: 3, y: 3 })]);

    expect(result.error?.issues.map(({ path, message }) => [path, message])).toEqual([
      [[1], 'The widget overlaps another widget'],
    ]);
  });

  it('refuses two widgets with one id', () => {
    const result = dashboardLayout.safeParse([list(), list({ x: 4 })]);

    expect(result.error?.issues.map(({ path }) => path)).toEqual([[1, 'id']]);
  });

  it('holds at most 40 widgets', () => {
    const many = Array.from({ length: 41 }, (_, index) => list({ id: `w${index}`, y: index * 4 }));

    expect(dashboardLayout.safeParse(many).success).toBe(false);
    expect(dashboardLayout.safeParse(many.slice(0, 40)).success).toBe(true);
  });
});

describe('core.saveDashboardTab (ADR 0078)', () => {
  it('takes the tab by id and version, and its layout as JSON', () => {
    const input = saveDashboardTab.input.parse({
      id: '019a0000-0000-7000-8000-0000000f0001',
      expectedVersion: 3,
      layout: JSON.stringify([list()]),
    });

    expect(input.layout).toEqual([list()]);
  });

  it('refuses a layout that is not JSON, or not a valid layout, on layout', () => {
    const base = { id: '019a0000-0000-7000-8000-0000000f0001', expectedVersion: 3 };

    for (const layout of ['[', JSON.stringify([list({ size: 'small' })])]) {
      const result = saveDashboardTab.input.safeParse({ ...base, layout });
      expect(result.error?.issues[0]?.path[0]).toBe('layout');
    }
  });
});
