// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { dashboardWidget } from '../src/dashboard.ts';

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
