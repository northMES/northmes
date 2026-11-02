// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  PlantCalendar,
  PlantSettingsSource,
} from '../../../src/modules/core/plant-settings-data.ts';
import { g1PlantSettingsSnapshot } from '../../../src/modules/core/plant-settings-data-g1.ts';
import { plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** An href of the plant with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  const query = new URLSearchParams(search).toString();
  return query === '' ? href : `${href}?${query}`;
}

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}




/** The height of an hour in the week view, in pixels. */
const hourPx = 36;

/**
 * Renders calendar A1 from the fixture G1 with A1 changed as the test needs it and returns its
 * week view of W45, the week the page opens on.
 */
async function weekOfA1(change: (a1: PlantCalendar) => PlantCalendar) {
  const snapshot = g1PlantSettingsSnapshot();
  const plantSettingsSource: PlantSettingsSource = {
    load: async () => ({
      ...snapshot,
      calendars: snapshot.calendars.map((each) => (each.name === 'A1' ? change(each) : each)),
    }),
  };
  renderCoreAt(coreLinks.settings.calendars.calendar({ plant, calendarId: 'A1' }).href, [], {
    plantSettingsSource,
  });
  await screen.findByRole('heading', { level: 1, name: 'Calendar A1' });
  return within(screen.getByRole('img', { name: /^Week 45:/ }));
}

/** The heights in pixels of the week view's blocks whose labels these are, in page order. */
function heightsOf(labels: readonly HTMLElement[]): number[] {
  return labels.map((label) => Number.parseFloat(label.parentElement?.style.height ?? ''));
}

describe('the calendar pages in plant settings (ADR 0025; design #688, CA1 and CA2)', () => {
  it("the calendars list's loading state draws the table's columns while the snapshot loads", async () => {
    renderCoreAt(
      withSearch(coreLinks.settings.calendars({ plant }).href, { preview: 'loading' }),
      [],
    );
    const table = await screen.findByRole('table', { name: 'Calendars' });
    expect(table.getAttribute('aria-busy')).toBe('true');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Name', 'Machines', 'Shift', 'Working time per week']);
  });

  it('MA8 the preview key opens the no-access state of the calendars list and of a calendar', async () => {
    renderCoreAt(
      withSearch(coreLinks.settings.calendars({ plant }).href, { preview: 'forbidden' }),
      [],
    );
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You need the permission to read calendars at this plant',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New calendar' })).toBeNull();
    cleanup();

    renderCoreAt(
      withSearch(coreLinks.settings.calendars.calendar({ plant, calendarId: 'A1' }).href, {
        preview: 'forbidden',
      }),
      [],
    );
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You need the permission to read calendars at this plant',
      }),
    ).toBeTruthy();
  });

  it('lists the calendars with their machines, shift and working time per week', async () => {
    renderCoreAt(coreLinks.settings.calendars({ plant }).href, []);
    const table = await screen.findByRole('table', { name: 'Calendars' });

    expect(bodyRows(table)).toEqual([
      ['A1', 'CNC 1, CNC 2, Mill 1', 'Mon to Fri 06:00 to 15:00', '41 h 15 min'],
      [
        'B3',
        'Lathe 1, Lathe 2',
        'Mon to Fri Early 06:00 to 14:00, Mon to Fri Late 14:00 to 22:00, Mon to Thu Night 22:00 to 06:00',
        '101 h 30 min',
      ],
    ]);
    expect(within(table).getByRole('link', { name: 'A1' }).getAttribute('href')).toBe(
      '/plant-a/settings/calendars/A1',
    );
    expect(screen.getByRole('button', { name: 'New calendar' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('CA1 shows the shift pattern, the deviations and the week view of W45', async () => {
    renderCoreAt(coreLinks.settings.calendars.calendar({ plant, calendarId: 'A1' }).href, []);

    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar A1' })).toBeTruthy();
    expect(
      screen.getByText(
        'Plant calendar of the plant, used by CNC 1, CNC 2 and Mill 1. Times are plant time, Europe/Stockholm.',
      ),
    ).toBeTruthy();
    const pattern = screen.getByRole('table', { name: 'Shift pattern of A1' });
    const rows = bodyRows(pattern);
    expect(rows[0]).toEqual([
      'Monday',
      'Day 06:00 to 15:00',
      'Day: 08:30 to 08:45, 11:00 to 11:30',
      '8 h 15 min',
    ]);
    expect(rows[5]).toEqual(['Saturday', 'Closed', '', '0 min']);
    expect(rows[7]).toEqual(['Per week', '41 h 15 min']);
    expect(
      screen.getByText(/Version in effect since Mon 5 Jan, one-week cycle anchored on Mondays\./),
    ).toBeTruthy();

    const deviations = screen.getByRole('table', { name: 'Deviations of A1' });
    expect(bodyRows(deviations).map((row) => row.slice(0, 3))).toEqual([
      ['Sat 7 Nov06:00 to 10:00', 'Overtime', 'Mill 1 only'],
      ['Mon 9 NovAll day', 'Non-working', 'All machines, plant-wide'],
    ]);
    expect(bodyRows(deviations)[0]?.[3]).toContain('Finish order 1006 before the holiday week');
    expect(bodyRows(deviations)[0]?.[3]).toContain('Added by Jonas Holm, Fri 30 Oct 10:05');

    const week = screen.getByRole('img', { name: /^Week 45:/ });
    expect(week.getAttribute('aria-label')).toBe(
      'Week 45: Monday to Friday 06:00 to 15:00 with two breaks, Saturday 06:00 to 10:00 overtime on Mill 1',
    );
    expect(screen.getByText('W45, Mon 2 Nov to Sun 8 Nov')).toBeTruthy();
    for (const label of ['New version', 'New deviation', 'Edit']) {
      expect(screen.getByRole('button', { name: label }).hasAttribute('disabled')).toBe(true);
    }
  });

  it('CA1 the week view moves by week in the URL and filters its deviations by machine', async () => {
    const router = renderCoreAt(
      coreLinks.settings.calendars.calendar({ plant, calendarId: 'A1' }).href,
      [],
    );
    await screen.findByRole('heading', { level: 1, name: 'Calendar A1' });

    await userEvent.click(screen.getByRole('button', { name: 'Show the later week' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ week: '2026-11-09' }));
    expect(screen.getByText('W46, Mon 9 Nov to Sun 15 Nov')).toBeTruthy();
    expect(screen.getByRole('img', { name: /^Week 46:/ }).getAttribute('aria-label')).toContain(
      'Monday 9 Nov closed, plant holiday',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Show the earlier week' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await userEvent.click(screen.getByRole('button', { name: 'CNC 1' }));
    expect(screen.getByRole('img', { name: /^Week 45:/ }).getAttribute('aria-label')).toBe(
      'Week 45: Monday to Friday 06:00 to 15:00 with two breaks',
    );
  });

  it("CA1 a day's closures stack in one column, so one machine's closure does not cover another's or the plant's", async () => {
    const closed = (id: string, date: string, next: string, machine: string) => ({
      id,
      kind: 'nonWorking' as const,
      startsLocal: `${date}T00:00`,
      endsLocal: `${next}T00:00`,
      equipment: [machine],
    });
    const w45 = await weekOfA1((a1) => ({
      ...a1,
      deviations: [
        ...a1.deviations,
        closed('cnc1-wed', '2026-11-04', '2026-11-05', 'CNC1'),
        closed('mill1-wed', '2026-11-04', '2026-11-05', 'MILL1'),
        closed('cnc2-holiday', '2026-11-09', '2026-11-10', 'CNC2'),
      ],
    }));

    /** The texts of the column that holds a closure: the day's closures and nothing else. */
    const closuresBeside = (closure: HTMLElement) =>
      Array.from(closure.parentElement?.children ?? [], (child) => child.textContent);
    expect(closuresBeside(w45.getByText('Closed on Mill 1'))).toEqual([
      'Closed on CNC 1',
      'Closed on Mill 1',
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Show the later week' }));
    const w46 = within(await screen.findByRole('img', { name: /^Week 46:/ }));
    expect(closuresBeside(w46.getByText('Closed on CNC 2'))).toEqual([
      'ClosedPlant holiday',
      'Closed on CNC 2',
    ]);
  });

  it('CA1 overtime that ends at midnight runs to the end of its day', async () => {
    const w45 = await weekOfA1((a1) => ({
      ...a1,
      deviations: [
        {
          id: 'sat-evening',
          kind: 'overtime',
          startsLocal: '2026-11-07T18:00',
          endsLocal: '2026-11-08T00:00',
        },
      ],
    }));

    expect(heightsOf(w45.getAllByText('Overtime 18:00 to 00:00'))).toEqual([6 * hourPx]);
  });

  it('CA1 a night shift sits on the day it starts and continues after midnight on the next day (ADR 0025 rule 1)', async () => {
    const w45 = await weekOfA1((a1) => ({
      ...a1,
      shifts: a1.shifts.map((day) => ({
        ...day,
        name: 'Night',
        start: '22:00',
        end: '06:00',
        breaks: [{ start: '02:00', end: '02:30' }],
      })),
      deviations: [],
    }));

    // Monday to Friday start at 22:00; Tuesday to Saturday hold the part after midnight.
    const nights = heightsOf(w45.getAllByText('Night 22:00 to 06:00'));
    expect(nights.toSorted((a, b) => a - b)).toEqual([
      ...Array(5).fill(2 * hourPx),
      ...Array(5).fill(6 * hourPx),
    ]);
    expect(heightsOf(w45.getAllByText('Break 02:00 to 02:30'))).toEqual(Array(5).fill(hourPx / 2));
  });

  it('CS1 a calendar with three shifts lists each shift by name and color in the pattern and above the week view (#770)', async () => {
    renderCoreAt(
      withSearch(coreLinks.settings.calendars.calendar({ plant, calendarId: 'B3' }).href, {
        week: '2026-11-09',
      }),
      [],
    );
    await screen.findByRole('heading', { level: 1, name: 'Calendar B3' });

    expect(
      screen.getByText(
        'Calendar of the plant, used by Lathe 1 and Lathe 2. Times are plant time, Europe/Stockholm.',
      ),
    ).toBeTruthy();
    const rows = bodyRows(screen.getByRole('table', { name: 'Shift pattern of B3' }));
    expect(rows[0]).toEqual([
      'Monday',
      'Early 06:00 to 14:00Late 14:00 to 22:00Night 22:00 to 06:00',
      'Early: 09:00 to 09:15, 11:30 to 12:00Late: 17:00 to 17:15, 19:30 to 20:00Night: 01:00 to 01:30, 03:30 to 03:45',
      '21 h 45 min',
    ]);
    expect(rows[4]?.[3]).toBe('14 h 30 min');
    expect(rows[5]).toEqual(['Saturday', 'Closed', '', '0 min']);
    expect(rows[7]).toEqual(['Per week', '101 h 30 min']);

    // The legend names every shift with its times before the view, so color is never the only cue.
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Early 06:00 to 14:00',
      'Late 14:00 to 22:00',
      'Night 22:00 to 06:00',
      'Break',
      'Overtime deviation',
      'Non-working deviation',
      'Closed time',
    ]);
    const week = screen.getByRole('img', { name: /^Week 46:/ });
    expect(legend.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(week.getAttribute('aria-label')).toBe(
      'Week 46: Monday to Friday Early 06:00 to 14:00 and Late 14:00 to 22:00, Monday to Thursday Night 22:00 to 06:00, each shift with two breaks, Monday 9 Nov closed, plant holiday, Saturday 06:00 to 12:00 overtime',
    );
  });

  it('CS1 each shift keeps its own color number on every day, its legend key included, the part after midnight too (#770)', async () => {
    renderCoreAt(
      withSearch(coreLinks.settings.calendars.calendar({ plant, calendarId: 'B3' }).href, {
        week: '2026-11-09',
      }),
      [],
    );
    const week = within(await screen.findByRole('img', { name: /^Week 46:/ }));
    const legend = within(screen.getByRole('list', { name: 'Legend' }));

    // A block and the legend key carry the number of the shift's color, which its edge and fill
    // tokens read: the first shift 1, the second 2, the third 3.
    for (const [name, color] of [
      ['Early 06:00 to 14:00', '1'],
      ['Late 14:00 to 22:00', '2'],
      ['Night 22:00 to 06:00', '3'],
    ] as const) {
      const blocks = week
        .getAllByText(name)
        .map((label) => label.parentElement?.getAttribute('data-shift-color'));
      expect(blocks.length, name).toBeGreaterThan(0);
      const item = legend.getAllByRole('listitem').find((each) => each.textContent === name);
      const key = item?.querySelector('[aria-hidden="true"]');
      for (const block of [...blocks, key?.getAttribute('data-shift-color')]) {
        expect(block, name).toBe(color);
      }
    }
    // Tuesday holds Monday's night after midnight: the plant holiday closes Monday only.
    expect(week.getAllByText('From Mon')).toHaveLength(1);
  });

  it("CS1 two shifts of one name keep apart, a shift without breaks says so, and the description counts each shift's breaks (#770)", async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const w45 = await weekOfA1((a1) => {
      const [day] = a1.shifts;
      if (day === undefined) throw new Error('A1 has a shift');
      return {
        ...a1,
        shifts: [
          { ...day, weekdays: [1, 2, 3, 4] },
          { ...day, weekdays: [5], end: '12:00', breaks: [], workingSeconds: 21_600 },
        ],
        deviations: [],
      };
    });

    expect(screen.getByRole('img', { name: /^Week 45:/ }).getAttribute('aria-label')).toBe(
      'Week 45: Monday to Thursday Day 06:00 to 15:00 with two breaks, Friday Day 06:00 to 12:00 with no breaks',
    );
    expect(w45.getAllByText('Day 06:00 to 12:00')).toHaveLength(1);
    const rows = bodyRows(screen.getByRole('table', { name: 'Shift pattern of A1' }));
    expect(rows[4]?.[2]).toBe('Day: No breaks');
    expect(
      within(screen.getByRole('list', { name: 'Legend' }))
        .getAllByRole('listitem')
        .slice(0, 2)
        .map((item) => item.textContent),
    ).toEqual(['Day 06:00 to 15:00', 'Day 06:00 to 12:00']);
    expect(errors.mock.calls.flat().join(' ')).not.toContain('same key');
    errors.mockRestore();
  });

  it('CS1 a calendar without shifts still draws the hours of a day and says it has no working days (#770)', async () => {
    await weekOfA1((a1) => ({ ...a1, shifts: [], deviations: [] }));

    expect(screen.getByRole('img', { name: /^Week 45:/ }).getAttribute('aria-label')).toBe(
      'Week 45: no working days',
    );
    expect(within(screen.getByRole('img', { name: /^Week 45:/ })).getByText('12:00')).toBeTruthy();
  });

  it('CA1 a break across midnight in a night shift shows on both dates (ADR 0025 rule 1)', async () => {
    const w45 = await weekOfA1((a1) => ({
      ...a1,
      shifts: a1.shifts.map((day) => ({
        ...day,
        name: 'Night',
        start: '22:00',
        end: '06:00',
        breaks: [{ start: '23:45', end: '00:15' }],
      })),
      deviations: [],
    }));

    // Monday to Friday hold 23:45 to midnight, Tuesday to Saturday midnight to 00:15.
    expect(heightsOf(w45.getAllByText('Break 23:45 to 00:15'))).toEqual(Array(10).fill(hourPx / 4));
  });

  it('CA1 a night calendar in a week closed every day still draws the hours of its shifts', async () => {
    const w45 = await weekOfA1((a1) => ({
      ...a1,
      shifts: a1.shifts.map((day) => ({ ...day, name: 'Night', start: '22:00', end: '06:00' })),
      deviations: [
        {
          id: 'closed-week',
          kind: 'nonWorking',
          startsLocal: '2026-11-02T00:00',
          endsLocal: '2026-11-09T00:00',
        },
      ],
    }));

    expect(w45.getByText('05:00')).toBeTruthy();
    expect(w45.getByText('23:00')).toBeTruthy();
  });

  it("CA1 plant overtime and a machine's overtime at the same time sit side by side", async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const w45 = await weekOfA1((a1) => ({
      ...a1,
      deviations: [
        ...a1.deviations,
        {
          id: 'sat-plant',
          kind: 'overtime',
          startsLocal: '2026-11-07T06:00',
          endsLocal: '2026-11-07T10:00',
        },
      ],
    }));

    const lefts = w45
      .getAllByText('Overtime 06:00 to 10:00')
      .map((label) => label.parentElement?.style.left);
    expect(lefts).toHaveLength(2);
    expect(new Set(lefts).size).toBe(2);
    expect(errors.mock.calls.flat().join(' ')).not.toContain('same key');
    errors.mockRestore();
  });
});
