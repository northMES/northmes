// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** A field by its label, with its value, whether it is read-only and its description. */
function field(name: string, role: 'textbox' | 'combobox' = 'textbox') {
  const element = screen.getByRole(role, { name }) as HTMLInputElement | HTMLSelectElement;
  const described = (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
  return {
    element,
    value: element.value,
    readOnly: element.hasAttribute('readonly'),
    invalid: element.getAttribute('aria-invalid') === 'true',
    described,
  };
}

describe("the plant's own page in plant settings (design #767, PP1 to PP7)", () => {
  it("PP1 shows the name editable, the slug read-only, and the zone and the day start fixed since the plant's first calendar version", async () => {
    renderCoreAt(coreLinks.settings.plant({ plant }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Plant' });

    expect(screen.getByText('Plant A, plant-a')).toBeTruthy();
    expect(field('Name')).toMatchObject({ value: 'Plant A', readOnly: false });
    expect(field('Slug')).toMatchObject({ value: 'plant-a', readOnly: true });
    expect(field('Time zone')).toMatchObject({ value: 'Europe/Stockholm', readOnly: true });
    expect(field('Production day start')).toMatchObject({ value: '06:00', readOnly: true });
    expect(screen.getByText("Fixed since the plant's first calendar version")).toBeTruthy();
    expect(screen.getByText(/Calendar A1 is in effect from Mon 5 Jan 2026\./)).toBeTruthy();
    expect(
      screen.getByText(
        'The production day of Mon 2 Nov runs from Mon 2 Nov 06:00 to Tue 3 Nov 06:00.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The production day of Sat 27 Mar 2027 lasts 23 h, because the clocks go forward that night.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save plant' }).hasAttribute('disabled')).toBe(true);
  });

  it('PP4 a plant without a calendar version takes a zone and a day start, and refuses 02:30 in Europe/Stockholm (ADR 0025, CAL8)', async () => {
    renderCoreAt(coreLinks.settings.plant({ plant }, { preview: 'noCalendar' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Plant' });

    expect(field('Time zone', 'combobox').value).toBe('Europe/Stockholm');
    const dayStart = field('Production day start');
    expect(dayStart.readOnly).toBe(false);

    await userEvent.clear(dayStart.element);
    await userEvent.type(dayStart.element, '02:30');
    await userEvent.tab();
    expect(field('Production day start')).toMatchObject({ invalid: true });
    expect(field('Production day start').described).toContain(
      '02:30 is skipped on Sun 28 Mar 2027 and occurs twice on Sun 31 Oct 2027 in Europe/Stockholm. Choose a time outside the hour the clocks change.',
    );

    // A change clears the error at once; the next check runs when the field is left.
    await userEvent.clear(dayStart.element);
    await userEvent.type(dayStart.element, '06:00');
    expect(field('Production day start').invalid).toBe(false);

    await userEvent.clear(dayStart.element);
    await userEvent.type(dayStart.element, '6');
    await userEvent.tab();
    expect(field('Production day start').described).toContain(
      'Enter the production day start as HH:MM, such as 06:00.',
    );

    await userEvent.clear(dayStart.element);
    await userEvent.type(dayStart.element, '06:00');
    await userEvent.tab();
    expect(field('Production day start').invalid).toBe(false);
  });

  it('PP1 at another plant than the fixture names the fixture instead of showing Plant A as this plant', async () => {
    renderCoreAt(coreLinks.settings.plant({ plant: 'plant-b' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Plant' });

    expect(await screen.findByText(/^The mock data holds Plant A only, at plant-a\./)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Slug' })).toBeNull();
  });

  it('PP4 the other plant settings pages ignore the noCalendar preview', async () => {
    renderCoreAt(
      coreLinks.settings.machines.machine.edit(
        { plant, equipmentId: 'CNC1' },
        { preview: 'noCalendar' },
      ).href,
      [],
    );
    await screen.findByRole('heading', { level: 1, name: 'Edit machine CNC1' });

    expect(field('Calendar', 'combobox').value).toBe('A1');
  });

  it('PP5 to PP7 the preview key opens the loading, failed and no-access states on mock data', async () => {
    renderCoreAt(coreLinks.settings.plant({ plant }, { preview: 'loading' }).href, []);
    expect(await screen.findByText('Loading the plant.')).toBeTruthy();
    cleanup();

    renderCoreAt(coreLinks.settings.plant({ plant }, { preview: 'error' }).href, []);
    expect(await screen.findByText('Could not load the plant')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    cleanup();

    renderCoreAt(coreLinks.settings.plant({ plant }, { preview: 'forbidden' }).href, []);
    expect(await screen.findByText('You need the permission to change this plant')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });
});
