// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GanttDataSource } from '../../../src/modules/planning/gantt-data.ts';
import { g1DataSource } from '../../../src/modules/planning/gantt-data.ts';
import { PlanningForbidden } from '../../../src/modules/planning/planning-preview.ts';
import { planningHref, plant, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

describe('the planning board page states (design D3, DR17 to DR22)', () => {
  it('DR17 draws the skeleton of the grid while the board loads, with the grid busy', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', preview: 'loading' }, undefined, 'board');

    const board = await screen.findByRole('grid', { name: /board/ });
    expect(board.getAttribute('aria-busy')).toBe('true');
    expect(within(board).queryAllByRole('gridcell')).toHaveLength(0);
    expect(board.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0);
    // The busy grid itself holds the Tab stop until its rows arrive (D3, DR17 and DR25).
    expect(board.getAttribute('tabindex')).toBe('0');
  });

  it('DR19 says the plant has no machines to plan and leads to Machines', async () => {
    renderGanttRoute({ preview: 'empty' }, undefined, 'board');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'No machines to plan at this plant yet',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The board shows the machines marked as plannable. A plant admin adds machines in Machines and marks them there.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Machines' }).getAttribute('href')).toBe(
      coreLinks.machines({ plant }).href,
    );
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Board' })).toBeNull();
    expect(screen.queryByText(/^ERP data as of/)).toBeNull();
  });

  it('DR20 shows the error state with Try again, which loads the board again', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const failingOnce: GanttDataSource = {
      load: async (input) => {
        attempts += 1;
        if (attempts === 1) throw new Error('The plan server did not answer');
        return g1DataSource.load(input);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, failingOnce, 'board');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'The board could not be loaded' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Your draft and the saved plan are not affected. Try again, or open the job table for the same range.',
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('grid', { name: /board/ })).toBeTruthy();
  });

  it('DR22 names the permission the board needs and shows no data', async () => {
    renderGanttRoute({ preview: 'forbidden' }, undefined, 'board');

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You cannot see the planning board at this plant',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The board needs the permission planning.jobOrder:read, and your role at this plant does not include it. Ask your plant admin for the Planner or Viewer role.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Board' })).toBeNull();
  });

  it('DR22 leads to the plant dashboard, which needs no planning permission', async () => {
    renderGanttRoute({ preview: 'forbidden' }, undefined, 'board');

    await screen.findByRole('heading', {
      level: 2,
      name: 'You cannot see the planning board at this plant',
    });
    expect(screen.getByRole('link', { name: 'Open the dashboard' }).getAttribute('href')).toBe(
      coreLinks.dashboard({ plant }).href,
    );
  });

  it('DR20 offers the job order table as a way out, for the same range', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02', preview: 'error' }, undefined, 'board');

    await screen.findByRole('heading', { level: 2, name: 'The board could not be loaded' });
    expect(screen.getByRole('link', { name: 'Open the job table' }).getAttribute('href')).toBe(
      `${planningLinks.jobOrders({ plant }).href}?zoom=week&from=2026-11-02`,
    );
  });

  it('DR20 Try again stays busy until the board has loaded again', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    let answer: (() => void) | undefined;
    const slowSecond: GanttDataSource = {
      load: async (input) => {
        attempts += 1;
        if (attempts === 1) throw new Error('The plan server did not answer');
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return g1DataSource.load(input);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, slowSecond, 'board');
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(answer).toBeDefined());
    expect(screen.getByRole('button', { name: /Try/ }).getAttribute('aria-busy')).toBe('true');
    answer?.();
    expect(await screen.findByRole('grid', { name: /board/ })).toBeTruthy();
  });

  it('DR22 a refusal of a later range shows no access, not the error state', async () => {
    const user = userEvent.setup();
    const refusingLater: GanttDataSource = {
      load: async (input) => {
        if (input.from.startsWith('2026-11-08')) throw new PlanningForbidden();
        return g1DataSource.load(input);
      },
    };
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, refusingLater, 'board');
    await screen.findByRole('grid', { name: /board/ });

    await user.click(await screen.findByRole('button', { name: 'Show later range' }));
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You cannot see the planning board at this plant',
      }),
    ).toBeTruthy();
  });

  it('DR17 a change to the loading preview drops the board shown before', async () => {
    const router = renderGanttRoute({ zoom: 'week', from: '2026-11-02' }, undefined, 'board');
    await waitFor(() =>
      expect(document.querySelector('[role="grid"]:not([aria-busy])')).not.toBeNull(),
    );

    await router.navigate({
      href: planningHref('board', { zoom: 'week', from: '2026-11-02', preview: 'loading' }),
    });
    await waitFor(() =>
      expect(screen.getByRole('grid', { name: /board/ }).getAttribute('aria-busy')).toBe('true'),
    );
  });
});
