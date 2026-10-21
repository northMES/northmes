// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

describe("the plant's own page in plant settings (design #767, PP1 to PP7)", () => {
  it("PP1 shows the name editable, the slug read-only, and the zone and the day start fixed since calendar A1's first version", async () => {
    renderCoreAt(coreLinks.plant({ plant }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Plant A' });

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Plant A');
    const slug = screen.getByRole('textbox', { name: 'Slug' });
    expect(slug).toHaveValue('plant-a');
    expect(slug).toHaveAttribute('readonly');
    const zone = screen.getByRole('textbox', { name: 'Time zone' });
    expect(zone).toHaveValue('Europe/Stockholm');
    expect(zone).toHaveAttribute('readonly');
    const dayStart = screen.getByRole('textbox', { name: 'Production day start' });
    expect(dayStart).toHaveValue('06:00');
    expect(dayStart).toHaveAttribute('readonly');
    expect(screen.getByText("Fixed since calendar A1's first version")).toBeInTheDocument();
    expect(
      screen.getByText(/Calendar A1 has a version from Mon 5 Jan 2026\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The production day of Mon 2 Nov runs from Mon 2 Nov 06:00 to Tue 3 Nov 06:00.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The production day of Sat 27 Mar 2027 lasts 23 h, because the clocks go forward that night.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save plant' })).toBeDisabled();
  });

  it('PP4 a plant without a calendar version takes a zone and a day start, and refuses 02:30 in Europe/Stockholm (ADR 0025, CAL8)', async () => {
    renderCoreAt(coreLinks.plant({ plant }, { preview: 'noCalendar' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Plant A' });

    expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveValue('Europe/Stockholm');
    const dayStart = screen.getByRole('textbox', { name: 'Production day start' });
    expect(dayStart).not.toHaveAttribute('readonly');

    await userEvent.clear(dayStart);
    await userEvent.type(dayStart, '02:30');
    await userEvent.tab();
    expect(dayStart).toHaveAttribute('aria-invalid', 'true');
    expect(dayStart).toHaveAccessibleDescription(
      expect.stringContaining(
        '02:30 is skipped on Sun 28 Mar 2027 and occurs twice on Sun 31 Oct 2027 in Europe/Stockholm. Choose a time outside the hour the clocks change.',
      ),
    );

    await userEvent.clear(dayStart);
    await userEvent.type(dayStart, '6');
    await userEvent.tab();
    expect(dayStart).toHaveAccessibleDescription(
      expect.stringContaining('Enter the production day start as HH:MM, such as 06:00.'),
    );

    await userEvent.clear(dayStart);
    await userEvent.type(dayStart, '06:00');
    await userEvent.tab();
    expect(dayStart).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('PP5 to PP7 the preview key opens the loading, failed and no-access states on mock data', async () => {
    renderCoreAt(coreLinks.plant({ plant }, { preview: 'loading' }).href, []);
    expect(await screen.findByText('Loading the plant.')).toBeInTheDocument();
    cleanup();

    renderCoreAt(coreLinks.plant({ plant }, { preview: 'error' }).href, []);
    expect(await screen.findByText('Could not load the plant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    cleanup();

    renderCoreAt(coreLinks.plant({ plant }, { preview: 'forbidden' }).href, []);
    expect(
      await screen.findByText('You need the permission to change this plant'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });
});
