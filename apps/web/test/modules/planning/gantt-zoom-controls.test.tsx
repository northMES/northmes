// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GanttDataSource, g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';
import { findGantt, measureGridsAt, renderGanttRoute } from './gantt-fixtures.tsx';

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
function ctrlWheel(
  gantt: HTMLElement,
  deltaY: number,
  clientX: number,
  ctrlKey = true,
  timeStamp = performance.now(),
): boolean {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  // The test browser's WheelEvent keeps neither the modifier nor the pointer's position.
  Object.defineProperties(event, {
    ctrlKey: { value: ctrlKey },
    clientX: { value: clientX },
    timeStamp: { value: timeStamp },
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

describe('the zoom of the order Gantt (ADR 0089, Zoom levels)', () => {
  it('#896 Zoom in and Zoom out step one level, the level menu picks any level of the ladder, Zoom out is disabled at Year, and the level is announced', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom out' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe('week'));

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom level, Week' }));
    const levels = await screen.findAllByRole('menuitemradio');
    expect(levels.map((item) => item.textContent)).toEqual([
      'Quarter hours',
      'Hours',
      'Day',
      'Week',
      '4 weeks',
      'Quarter',
      'Year',
    ]);
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Year' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe('year'));
    expect(
      within(zoom).getByRole('button', { name: 'Zoom out' }).getAttribute('aria-disabled'),
    ).toBe('true');
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe('Zoom level Year'),
    );
  });

  it("#896 minus, plus and = with focus in the grid step a level, and the keys with Ctrl stay the browser's", async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const row = gantt.querySelector<HTMLElement>('[data-row-id]') as HTMLElement;
    row.focus();

    await userEvent.keyboard('+');
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    await userEvent.keyboard('-');
    await waitFor(() => expect(router.state.location.search.zoom).toBe('week'));

    // "=" is plus without Shift on many layouts.
    await userEvent.keyboard('=');
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    await userEvent.keyboard('-');
    await waitFor(() => expect(router.state.location.search.zoom).toBe('week'));

    const browserZoom = fireEvent.keyDown(row, { key: '+', ctrlKey: true });
    expect(browserZoom).toBe(true);
    expect(router.state.location.search.zoom).toBe('week');
  });

  it('#896 Ctrl+wheel over the time area steps one level per gesture and keeps the page from zooming; a plain wheel and a Ctrl+wheel over the tree columns are left to the browser', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(ctrlWheel(gantt, -40, 1200, false)).toBe(false);
    expect(ctrlWheel(gantt, -40, 50)).toBe(false);
    expect(router.state.location.search.zoom).toBe('week');

    const start = performance.now();
    expect(ctrlWheel(gantt, -40, 1200, true, start)).toBe(true);
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    // The rest of the same pinch, each event within 200 ms of the one before, steps no further.
    expect(ctrlWheel(gantt, -40, 1200, true, start + 100)).toBe(true);
    expect(ctrlWheel(gantt, -40, 1200, true, start + 250)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.state.location.search.zoom).toBe('day');
    // After a pause of more than 200 ms the next gesture steps again.
    ctrlWheel(gantt, -40, 1200, true, start + 600);
    await waitFor(() => expect(router.state.location.search.zoom).toBe('hours'));
  });

  it('#896 Zoom to fit fits the selected order, and says so', async () => {
    const router = renderGanttRoute({ zoom: 'year', from: '2026-11-01', order: 'po-1003' });
    await findGantt();

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
        name: 'Zoom to fit',
      }),
    );

    // Order 1003 runs from Wed 4 Nov 08:00 to Thu 5 Nov 06:15, a night of closed time between,
    // which Hide closed time (on by default) compresses: Hours holds it in the view.
    await waitFor(() => expect(router.state.location.search.zoom).toBe('hours'));
    // from names the visible start (ADR 0089), a step before the order's start.
    expect(router.state.location.search.from).toMatch(/^2026-11-04T0[67]:/);
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'Zoomed to fit order 1003, zoom level Hours',
      ),
    );
  });

  it('#896 a two-finger pinch on a touchscreen steps one level per pinch, and the grid leaves pinch zoom to it', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    expect(gantt.style.touchAction).toBe('pan-x pan-y');

    touch(gantt, 'touchstart', [
      [900, 300],
      [1000, 300],
    ]);
    touch(gantt, 'touchmove', [
      [850, 300],
      [1050, 300],
    ]);
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    touch(gantt, 'touchmove', [
      [700, 300],
      [1200, 300],
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(router.state.location.search.zoom).toBe('day');
    touch(gantt, 'touchend', []);
  });

  it("#896 Safari's trackpad pinch over the time area steps one level and keeps the page from zooming", async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    expect(gesture(gantt, 'gesturestart', 1, 1200)).toBe(true);
    expect(gesture(gantt, 'gesturechange', 0.6, 1200)).toBe(true);
    await waitFor(() => expect(router.state.location.search.zoom).toBe('4weeks'));
  });

  it('#896 Now keeps the level and rebuilds the range around now, also at Quarter hours', async () => {
    const router = renderGanttRoute({ zoom: 'quarter-hours', from: '2026-11-05' });
    const gantt = await findGantt();
    Object.defineProperty(gantt, 'scrollLeft', { value: 0, configurable: true, writable: true });

    await userEvent.click(screen.getByRole('button', { name: 'Now' }));

    // G1's now is Mon 2 Nov 09:40, 3 h 40 min into the range at 240 px an hour: the grid scrolls
    // so now sits at the centre of the time area instead of the range's start at its left edge.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-11-02T0[789]:/));
    expect(router.state.location.search.zoom).toBe('quarter-hours');
    await waitFor(() => expect(gantt.scrollLeft).toBeGreaterThan(0));
  });

  it('#896 the level menu closes once a level is picked', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    await findGantt();
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom level, Week' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Day' }));

    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('#896 with no rows to draw, the zoom controls and Now still set the level and the start', async () => {
    const empty: GanttDataSource = {
      ...g1DataSource,
      load: async (input) => ({ ...(await g1DataSource.load(input)), productionOrders: [] }),
    };
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-09' }, empty);
    await screen.findByText('No orders in this range');
    const zoom = screen.getByRole('group', { name: 'Zoom' });

    await userEvent.click(within(zoom).getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(router.state.location.search.zoom).toBe('day'));
    // With no grid drawn the zoom still keeps the centre of the view, so the start stays on the
    // week the URL named.
    expect(router.state.location.search.from).toMatch(/^2026-11-(09|1\d)T/);
    await userEvent.click(screen.getByRole('button', { name: 'Now' }));
    // G1's now, Mon 2 Nov 09:40, sits at the centre of the view; with closed time hidden, the half
    // of the view before it reaches back over the weekend to Friday.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-10-30T/));
  });

  it('#896 at the end of the ladder Zoom out keeps focus and minus says why it steps no further', async () => {
    const router = renderGanttRoute({ zoom: 'quarter', from: '2026-11-01' });
    const gantt = await findGantt();
    const out = within(screen.getByRole('group', { name: 'Zoom' })).getByRole('button', {
      name: 'Zoom out',
    });

    await userEvent.click(out);
    await waitFor(() => expect(router.state.location.search.zoom).toBe('year'));
    expect(out.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(out);

    (gantt.querySelector('[data-row-id]') as HTMLElement).focus();
    await userEvent.keyboard('-');
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'Year is the coarsest zoom level',
      ),
    );
    expect(router.state.location.search.zoom).toBe('year');
  });

  it('#896 a held minus or plus steps once, not on every repeat', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const row = gantt.querySelector<HTMLElement>('[data-row-id]') as HTMLElement;

    fireEvent.keyDown(row, { key: '+', repeat: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(router.state.location.search.zoom).toBe('week');
  });

  it('ADR0089 Now rebuilds the buffer around now at the centre of the view and keeps the level', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-09' });
    await findGantt();

    await userEvent.click(screen.getByRole('button', { name: 'Now' }));

    // G1's now is Mon 2 Nov 09:40; the view starts half a view before it, which with closed time
    // hidden is 26 open hours back, on Wed 28 Oct.
    await waitFor(() => expect(router.state.location.search.from).toMatch(/^2026-10-28T/));
    expect(router.state.location.search.zoom).toBe('week');
  });

  it('#896 zooms no level while a block is dragged, so the drop stays under the pointer', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const block = gantt.querySelector('[data-block="jo-1001-10"]') as HTMLElement;
    const pointer = { pointerId: 1, button: 0, isPrimary: true, clientY: 300 };
    fireEvent.pointerDown(block, { ...pointer, clientX: 900 });
    fireEvent.pointerMove(block, { ...pointer, clientX: 910 });
    await waitFor(() => expect(gantt.querySelector('[data-move-preview]')).not.toBeNull());

    ctrlWheel(gantt, -40, 1200);
    fireEvent.keyDown(block, { key: '+' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(router.state.location.search.zoom).toBe('week');
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
