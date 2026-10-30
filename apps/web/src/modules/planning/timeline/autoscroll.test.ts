// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { autoscrollStep, revealDelta } from './autoscroll.ts';

// The visible time area: 200 px of sticky tree columns on the left, a 48 px header on top.
const area = { left: 200, top: 48, right: 1000, bottom: 600 };

describe('the autoscroll step of a drag near an edge of the time area (#899)', () => {
  it('is none while the pointer is further from every edge than the margin', () => {
    expect(autoscrollStep({ x: 600, y: 300 }, area)).toEqual({ dx: 0, dy: 0 });
    expect(autoscrollStep({ x: area.right - 48, y: 300 }, area)).toEqual({
      dx: 0,
      dy: 0,
    });
  });

  it('scrolls right near the right edge, faster the closer the pointer is', () => {
    const far = autoscrollStep({ x: area.right - 36, y: 300 }, area);
    const near = autoscrollStep({ x: area.right - 6, y: 300 }, area);

    expect(far.dx).toBeGreaterThan(0);
    expect(near.dx).toBeGreaterThan(far.dx);
    expect(near.dy).toBe(0);
  });

  it('scrolls left near the left edge of the time area, not of the grid', () => {
    expect(autoscrollStep({ x: area.left + 6, y: 300 }, area).dx).toBeLessThan(0);
    expect(autoscrollStep({ x: 120, y: 300 }, area).dx).toBe(-24);
  });

  it('scrolls at the most speed with the pointer past an edge', () => {
    expect(autoscrollStep({ x: 1200, y: 300 }, area).dx).toBe(24);
  });

  it('scrolls up and down near the top and the bottom', () => {
    expect(autoscrollStep({ x: 600, y: area.top + 4 }, area).dy).toBeLessThan(0);
    expect(autoscrollStep({ x: 600, y: area.bottom - 4 }, area).dy).toBeGreaterThan(0);
  });
});

describe('the scroll that reveals a move preview in keyboard move mode (#899)', () => {
  it('is none for a preview inside the visible time area', () => {
    expect(revealDelta({ left: 400, right: 500 }, area)).toBe(0);
  });

  it('scrolls right by what the preview overhangs the right edge, and left by what it overhangs the left', () => {
    expect(revealDelta({ left: 1100, right: 1150 }, area)).toBe(150);
    expect(revealDelta({ left: 100, right: 150 }, area)).toBe(-100);
  });

  it('keeps the start of a preview wider than the area in view', () => {
    expect(revealDelta({ left: 900, right: 2000 }, area)).toBe(700);
  });

  it('keeps 8 px of the focused block in view past the sticky columns (WCAG 2.4.11)', () => {
    expect(revealDelta({ left: 1100, right: 1150 }, area, { left: 300, right: 380 })).toBe(150);
    expect(revealDelta({ left: 1100, right: 1150 }, area, { left: 250, right: 300 })).toBe(92);
    expect(revealDelta({ left: 100, right: 150 }, area, { left: 900, right: 950 })).toBe(-92);
  });
});
