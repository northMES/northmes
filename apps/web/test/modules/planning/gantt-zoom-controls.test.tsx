// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { g1Snapshot } from '../../../src/modules/planning/gantt-data-g1.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { findGantt, measureGridsAt, renderGanttRoute, sourceOf } from './gantt-fixtures.tsx';

// The grid measures 1 400 px, as a laid-out page would report it.
beforeEach(() => measureGridsAt(1400));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * A Ctrl+wheel event over the grid at a viewport x, and whether its default was prevented. The
 * time stamp, in milliseconds, says which events belong to one gesture.
 */
function ctrlWheel(gantt: HTMLElement, deltaY: number, clientX: number, ctrlKey = true): boolean {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  // The test browser's WheelEvent keeps neither the modifier nor the pointer's position.
  Object.defineProperties(event, {
    ctrlKey: { value: ctrlKey },
    clientX: { value: clientX },
    deltaMode: { value: 0 },
  });
  gantt.dispatchEvent(event);
  return event.defaultPrevented;
}

/** A touch event with its touches at client points, and whether its default was prevented. */
function touch(gantt: HTMLElement, type: string, points: readonly [number, number][]): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touches = points.map(([clientX, clientY]) => ({ clientX, clientY }));
  Object.defineProperty(event, 'touches', { value: touches });
  gantt.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Safari's gesture event of a trackpad pinch, and whether its default was prevented. */
function gesture(gantt: HTMLElement, type: string, scale: number, clientX: number): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, { scale: { value: scale }, clientX: { value: clientX } });
  gantt.dispatchEvent(event);
  return event.defaultPrevented;
}

/** The drawn width of a block, which follows the width per hour. */
const blockWidth = (gantt: HTMLElement, id = 'jo-1001-10') =>
  Number.parseFloat((gantt.querySelector(`[data-block="${id}"]`) as HTMLElement).style.width);

const polite = () => document.getElementById(politeRegionId)?.textContent;

/** Reduced motion, as the planner's system settings ask for it. */
function preferReducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion: reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('the smooth zoom of the order Gantt (ADR 0090, Gestures, buttons and keys)', () => {
  it('#941 Zoom in from 16 gives 32 and Zoom out gives 16 again, over a short animation, and the band is announced', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    const zoom = screen.getByRole('group', { name: 'Zoom' });
    const before = blockWidth(gantt);

    fireEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    // The animation has not drawn its first frame yet.
    expect(blockWidth(gantt)).toBe(before);
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
    expect(blockWidth(gantt)).toBeGreaterThan(1.8 * before);
    await waitFor(() => expect(polite()).toBe('Zoom: Day'));

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom out' }));
    // The default zoom, 16, leaves the URL.
    await waitFor(() => expect(router.state.location.search.zoom).toBeUndefined());
    await waitFor(() => expect(polite()).toBe('Zoom: Week'));
  });

  it('#941 with reduced motion, Zoom in changes the zoom at once', async () => {
    preferReducedMotion();
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    const before = blockWidth(gantt);

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', { name: 'Zoom in' }),
    );

    expect(blockWidth(gantt)).toBeGreaterThan(1.8 * before);
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
  });

  it('#941 a press during the animation compounds from its target', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    await findGantt();
    const zoomIn = within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
      name: 'Zoom in',
    });

    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);

    await waitFor(() => expect(router.state.location.search.zoom).toBe(64));
  });

  it("#941 minus, plus and = with focus in the grid zoom by a factor of 2, and the keys with Ctrl stay the browser's", async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const row = gantt.querySelector<HTMLElement>('[data-row-id]') as HTMLElement;
    row.focus();

    await userEvent.keyboard('+');
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
    await userEvent.keyboard('-');
    await waitFor(() => expect(router.state.location.search.zoom).toBeUndefined());

    // "=" is plus without Shift on many layouts.
    await userEvent.keyboard('=');
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));

    const browserZoom = fireEvent.keyDown(row, { key: '+', ctrlKey: true });
    expect(browserZoom).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(router.state.location.search.zoom).toBe(32);
  });

  it('#941 Ctrl+wheel over the time area zooms by exp(-deltaY * 0.002) and keeps the page from zooming; a plain wheel and a Ctrl+wheel over the tree columns are left to the browser', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();

    expect(ctrlWheel(gantt, -40, 1200, false)).toBe(false);
    expect(ctrlWheel(gantt, -40, 50)).toBe(false);

    // Five events of -40 make one gesture, 16 * exp(0.4) = 23.9 px an hour, still in Week.
    for (let event = 0; event < 5; event += 1) expect(ctrlWheel(gantt, -40, 1200)).toBe(true);

    await waitFor(() => expect(router.state.location.search.zoom).toBe(23.9));
    await waitFor(() => expect(polite()).toBe('Zoom: Week'));
  });

  it('#941 the instant under the pointer stays at its x through a Ctrl+wheel gesture', async () => {
    renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    Object.defineProperty(gantt, 'scrollLeft', { value: 900, configurable: true, writable: true });
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1001-10"]') as HTMLElement;
    // The block's left edge, at a viewport x of the grid scrolled to 900 px.
    const leftAt = () =>
      Number.parseFloat(block.style.left) + paneWidthOf(gantt) - gantt.scrollLeft;
    const pointerX = leftAt();

    for (let event = 0; event < 10; event += 1) ctrlWheel(gantt, -20, pointerX);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(Math.abs(leftAt() - pointerX)).toBeLessThanOrEqual(1);
  });

  it('#941 a Ctrl+wheel gesture over the workload panel zooms the timeline, not the page', async () => {
    window.localStorage.setItem(
      'northmes.planning.gantt.options',
      JSON.stringify({ workload: true }),
    );
    try {
      const router = renderGanttRoute({ from: '2026-11-02' });
      await findGantt();
      const lanes = await waitFor(
        () => document.querySelector<HTMLElement>('[data-workload-lanes]') as HTMLElement,
      );

      expect(ctrlWheel(lanes, -100, 1200)).toBe(true);

      // exp(0.2) of 16 is 19.5 px an hour.
      await waitFor(() => expect(router.state.location.search.zoom).toBe(19.5));
    } finally {
      window.localStorage.removeItem('northmes.planning.gantt.options');
    }
  });

  it('#941 Zoom to fit fits the selected order, and says so', async () => {
    const router = renderGanttRoute({ zoom: 'year', from: '2026-11-01', order: 'po-1003' });
    await findGantt();

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
        name: 'Zoom to fit',
      }),
    );

    // Order 1003 runs from Wed 4 Nov 08:00 to Thu 5 Nov 06:15, a night of closed time between,
    // which Hide closed time (on by default) compresses: it fits in the Hours band.
    await waitFor(() => expect(polite()).toBe('Zoomed to fit order 1003. Zoom: Hours'));
    const zoom = router.state.location.search.zoom as number;
    expect(zoom).toBeGreaterThan(69.3);
    expect(zoom).toBeLessThan(154.9);
    // from names the visible start (ADR 0089), a step before the order's start.
    expect(router.state.location.search.from).toMatch(/^2026-11-04T0[67]:/);
  });

  it('#941 a two-finger pinch on a touchscreen zooms by the change in distance between the fingers, and the grid leaves pinch zoom to it', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    expect(gantt.style.touchAction).toBe('pan-x pan-y');

    touch(gantt, 'touchstart', [
      [900, 300],
      [1000, 300],
    ]);
    touch(gantt, 'touchmove', [
      [875, 300],
      [1025, 300],
    ]);
    touch(gantt, 'touchmove', [
      [850, 300],
      [1050, 300],
    ]);
    touch(gantt, 'touchend', []);

    // From 100 px apart to 200 px: twice the zoom.
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
  });

  it("#941 Safari's trackpad pinch over the time area zooms by its scale and keeps the page from zooming", async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();

    expect(gesture(gantt, 'gesturestart', 1, 1200)).toBe(true);
    expect(gesture(gantt, 'gesturechange', 0.8, 1200)).toBe(true);
    expect(gesture(gantt, 'gesturechange', 0.6, 1200)).toBe(true);

    await waitFor(() => expect(router.state.location.search.zoom).toBe(9.6));
  });

  it('#941 Go to now keeps the zoom and rebuilds the range around now, also at Quarter hours', async () => {
    const router = renderGanttRoute({ zoom: 'quarter-hours', from: '2026-11-05' });
    const gantt = await findGantt();
    Object.defineProperty(gantt, 'scrollLeft', { value: 0, configurable: true, writable: true });

    await userEvent.click(screen.getByRole('button', { name: 'Now' }));

    // G1's now is Mon 2 Nov 09:40, 3 h 40 min into the range at 240 px an hour: the grid scrolls
    // so now sits at the centre of the time area instead of the range's start at its left edge.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-02T0[789]:/));
    expect(router.state.location.search.zoom).toBe(240);
    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(0));
  });

  it('#941 the level menu names the band and opens a level at its natural width', async () => {
    const router = renderGanttRoute({ zoom: 26, from: '2026-11-02' });
    await findGantt();
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    // 26 px an hour lies in the Week band.
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom level, Week' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Day' }));

    await waitFor(() => expect(router.state.location.search.zoom).toBe(48));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('#941 with no rows to draw, the zoom controls and Go to now still set the zoom and the start', async () => {
    const router = renderGanttRoute(
      { from: '2026-11-09' },
      sourceOf({ ...g1Snapshot(), productionOrders: [] }),
    );
    await screen.findByText('No open orders');
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe(32));
    // With no grid drawn the zoom still keeps the centre of the view, so the start stays on the
    // week the URL named.
    expect(router.state.location.search.from).toMatch(/^2026-11-(09|1\d)T/);
    await userEvent.click(screen.getByRole('button', { name: 'Now' }));
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-1[01]-/));
  });

  it('#941 at the coarsest clamp Zoom out is disabled and keeps focus, and minus says why it zooms no further', async () => {
    const router = renderGanttRoute({ zoom: 0.3, from: '2026-11-01' });
    const gantt = await findGantt();
    const out = within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
      name: 'Zoom out',
    });

    await userEvent.click(out);
    await waitFor(() => expect(router.state.location.search.zoom).toBe(0.15));
    expect(out.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(out);

    (gantt.querySelector('[data-row-id]') as HTMLElement).focus();
    await userEvent.keyboard('-');
    await waitFor(() => expect(polite()).toBe('Year is the coarsest zoom'));
    expect(router.state.location.search.zoom).toBe(0.15);
  });

  it('#941 Zoom in is disabled at the finest clamp', async () => {
    renderGanttRoute({ zoom: 240, from: '2026-11-04' });
    await findGantt();

    expect(
      within(screen.getByRole('group', { name: 'Zoom' }))
        .getByRole('button', { name: 'Zoom in' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('#941 a held minus or plus zooms once, not on every repeat', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    const row = gantt.querySelector<HTMLElement>('[data-row-id]') as HTMLElement;

    fireEvent.keyDown(row, { key: '+', repeat: true });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(router.state.location.search.zoom).toBeUndefined();
  });

  it('#941 zooms nothing while a block is dragged, so the drop stays under the pointer', async () => {
    const router = renderGanttRoute({ from: '2026-11-02' });
    const gantt = await findGantt();
    const block = gantt.querySelector('[data-block="jo-1001-10"]') as HTMLElement;
    const pointer = { pointerId: 1, button: 0, isPrimary: true, clientY: 300 };
    fireEvent.pointerDown(block, { ...pointer, clientX: 900 });
    fireEvent.pointerMove(block, { ...pointer, clientX: 910 });
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).not.toBeNull());
    const before = blockWidth(gantt);

    ctrlWheel(gantt, -40, 1200);
    fireEvent.keyDown(block, { key: '+' });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(blockWidth(gantt)).toBe(before);
    expect(router.state.location.search.zoom).toBeUndefined();
    fireEvent.pointerUp(block, { ...pointer, clientX: 910 });
  });

  it('#896 the row menu has no disabled Zoom to order, which Zoom to fit replaces', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for order 1001' }));

    expect(await screen.findByRole('menuitem', { name: 'Show critical chain' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Zoom to order' })).toBeNull();
  });
});

/** The width of the Gantt's tree pane, where the time area starts in the grid's content. */
function paneWidthOf(gantt: HTMLElement): number {
  const header = [...gantt.querySelectorAll<HTMLElement>('[style]')].find(
    (element) => element.style.gridTemplateColumns !== '',
  );
  return Number.parseFloat(header?.style.gridTemplateColumns.split(' ')[0] ?? '0');
}
