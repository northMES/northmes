// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlantSettingsSource } from '../../../src/modules/core/plant-settings-data.ts';
import { g1PlantSettingsSnapshot } from '../../../src/modules/core/plant-settings-data-g1.ts';
import { plantSettingsActionReason } from '../../../src/modules/core/plant-settings-reasons.ts';
import { plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

/** The status line above the list. */
function statusLine(): string {
  return document.querySelector('[data-list-status]')?.textContent ?? '';
}

/** The definition of a term in the page's description lists, as its text. */
function definition(term: string): string {
  const dt = screen.getByText(term, { selector: 'dt' });
  return dt.nextElementSibling?.textContent ?? '';
}

/** An href with a search. */
function withSearch(href: string, search: Record<string, string>): string {
  return `${href}?${new URLSearchParams(search).toString()}`;
}

const groups = coreLinks.equipmentGroups({ plant }).href;
const mach = coreLinks.equipmentGroups.group({ plant, groupCode: 'MACH' }).href;
const editMach = coreLinks.equipmentGroups.group.edit({ plant, groupCode: 'MACH' }).href;

describe('the equipment groups in plant settings (design #729, EG1 to EG9)', () => {
  it('#729 EG1 lists the groups by code with their color, scope, machines, where the color came from and the source', async () => {
    renderCoreAt(groups, []);
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });

    expect(bodyRows(table)).toEqual([
      [
        'Color 8',
        'ASM',
        'Assembly',
        'Plant A',
        '1 machineAssembly bench',
        'Set here',
        'Created in NorthMES',
        'Edit',
      ],
      [
        'Color 1',
        'HEAT',
        'Heat treatment',
        'Acme AB',
        'No machines at Plant A',
        'Assigned from the palette',
        'From the ERP',
        'Edit',
      ],
      [
        'Color 3',
        'MACH',
        'Machining',
        'Plant A',
        '3 machinesCNC 1, CNC 2, Mill 1',
        'From the ERP',
        'From the ERP',
        'Edit',
      ],
    ]);
    expect(statusLine()).toBe(
      '3 equipment groups, 4 machines. Sorted by code. HEAT is a company group with no machines at Plant A.',
    );
    expect(screen.getByRole('note').textContent).toBe(
      'A group keeps the color it has. A group new from the ERP takes the color the ERP sends, else the first of the 20 palette colors that no other group uses.',
    );
    expect(screen.getByText('ERP data as of Mon 2 Nov 06:40')).toBeTruthy();
    expect(screen.getByText('Showing fixture G1.')).toBeTruthy();
    expect(screen.getByText(plantSettingsActionReason)).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'MACH' }).getAttribute('href')).toBe(mach);
    expect(within(table).getByRole('link', { name: 'Edit MACH' }).getAttribute('href')).toBe(
      editMach,
    );
    expect(
      screen.getByRole('button', { name: 'New equipment group' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByRole('region', { name: 'Equipment groups, scrolls sideways' })).toBeTruthy();
  });

  it('#729 EG1 filters by Scope through its menu and from the URL, with a chip and Clear filters', async () => {
    const router = renderCoreAt(groups, []);
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });

    await userEvent.click(screen.getByRole('button', { name: 'Scope' }));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /^Acme AB/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toEqual({ scope: 'company' }));
    expect(bodyRows(table).map((row) => row[1])).toEqual(['HEAT']);
    expect(statusLine()).toMatch(/^1 equipment group, 0 machines\./);
    await userEvent.click(screen.getByRole('button', { name: 'Remove the scope filter' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(bodyRows(table).map((row) => row[1])).toEqual(['ASM', 'HEAT', 'MACH']);

    await userEvent.click(screen.getByRole('button', { name: 'Scope' }));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /^Plant A/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyRows(table).map((row) => row[1])).toEqual(['ASM', 'MACH']));
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Scope' }));

    cleanup();
    renderCoreAt(withSearch(groups, { scope: 'plant' }), []);
    const plantGroups = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });
    expect(bodyRows(plantGroups).map((row) => row[1])).toEqual(['ASM', 'MACH']);
  });

  it('#729 EG1 names the company in the Scope menu at a plant with no company group', async () => {
    const snapshot = g1PlantSettingsSnapshot();
    const plantSettingsSource: PlantSettingsSource = {
      load: async () => ({
        ...snapshot,
        equipmentGroups: snapshot.equipmentGroups.filter((group) => group.code !== 'HEAT'),
      }),
    };
    renderCoreAt(groups, [], { plantSettingsSource });
    await screen.findByRole('table', { name: 'Equipment groups of Plant A' });
    await userEvent.click(screen.getByRole('button', { name: 'Scope' }));
    expect(await screen.findByRole('menuitemcheckbox', { name: /^Acme AB/ })).toBeTruthy();
  });

  it('#729 EG6 to EG9 show the loading, empty, failed and no-access states', async () => {
    renderCoreAt(withSearch(groups, { preview: 'loading' }), []);
    expect(
      (await screen.findByRole('table', { name: 'Equipment groups' })).getAttribute('aria-busy'),
    ).toBe('true');

    cleanup();
    renderCoreAt(withSearch(groups, { preview: 'empty' }), []);
    await screen.findByRole('heading', { level: 2, name: 'No equipment groups yet' });
    expect(
      screen.getByText(
        'Equipment groups come from the ERP with the machines, or are created here. Every machine on the board needs a group.',
      ),
    ).toBeTruthy();

    cleanup();
    renderCoreAt(withSearch(groups, { preview: 'error' }), []);
    await screen.findByRole('heading', { level: 2, name: 'Could not load equipment groups' });

    cleanup();
    renderCoreAt(withSearch(groups, { preview: 'forbidden' }), []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to manage the settings of this plant',
    });
    expect(screen.queryByRole('button', { name: 'New equipment group' })).toBeNull();
  });
});

describe("an equipment group's page (design #729, EG4)", () => {
  it('#729 EG4 shows MACH with its color from the ERP, its machines and the band it draws on the board', async () => {
    renderCoreAt(mach, []);
    await screen.findByRole('heading', { level: 1, name: 'Equipment group MACH' });

    expect(definition('Code')).toBe('MACHFrom the ERP');
    expect(definition('Name')).toBe('Machining');
    expect(definition('Scope')).toBe('Plant A');
    expect(definition('Color')).toBe(
      'Color 3The ERP sent it with the first import. The group keeps it: a later import color does not replace it.',
    );
    expect(
      screen.getByText("3 machines at Plant A. A machine's group is set on the machine's page."),
    ).toBeTruthy();
    const machines = screen.getByRole('table', { name: 'Machines in MACH' });
    expect(bodyRows(machines)).toEqual([
      ['CNC1', 'CNC 1', 'Yes', 'A1'],
      ['CNC2', 'CNC 2', 'Yes', 'A1'],
      ['MILL1', 'Mill 1', 'Yes', 'A1'],
    ]);
    expect(within(machines).getByRole('link', { name: 'CNC1' }).getAttribute('href')).toBe(
      coreLinks.machines.machine({ plant, equipmentId: 'CNC1' }).href,
    );
    expect(screen.getByRole('figure', { name: 'Machining on the board' }).textContent).toBe(
      'Machining3 machinesCNC 1CNC 2Mill 1',
    );
    expect(screen.getByRole('link', { name: 'Edit equipment group' }).getAttribute('href')).toBe(
      editMach,
    );
  });

  it('#729 EG4 says the company group HEAT took the first free palette color and has no machines here', async () => {
    renderCoreAt(coreLinks.equipmentGroups.group({ plant, groupCode: 'HEAT' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Equipment group HEAT' });

    expect(definition('Scope')).toBe('Acme ABA company group: every plant of Acme AB may use it.');
    expect(definition('Color')).toBe(
      'Color 1The ERP sent no color, so the group took the first of the 20 palette colors that no other group used. The group keeps it.',
    );
    expect(
      screen.getByText("No machines at Plant A. A machine's group is set on the machine's page."),
    ).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Machines in HEAT' })).toBeNull();
  });

  it('#729 EG4 names the group in the h1 while it loads', async () => {
    renderCoreAt(withSearch(mach, { preview: 'loading' }), []);
    await screen.findByRole('heading', { level: 1, name: 'Equipment group MACH' });
  });

  it('#729 EG4 says a group does not exist, with the way back, and shows the failed and no-access states', async () => {
    renderCoreAt(coreLinks.equipmentGroups.group({ plant, groupCode: 'NOPE' }).href, []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'This equipment group does not exist or you cannot see it',
    });
    expect(
      screen.getByRole('link', { name: 'Back to Equipment groups' }).getAttribute('href'),
    ).toBe(groups);

    cleanup();
    renderCoreAt(withSearch(mach, { preview: 'error' }), []);
    await screen.findByRole('heading', { level: 2, name: 'Could not load the equipment group' });

    cleanup();
    renderCoreAt(withSearch(mach, { preview: 'forbidden' }), []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to manage the settings of this plant',
    });
  });
});

describe("an equipment group's edit form (design #729, EG5)", () => {
  it("#729 EG5 keeps the ERP's code and name, offers the 20 palette colors with the groups that use them, and previews the band", async () => {
    renderCoreAt(editMach, []);
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group MACH' });

    expect(screen.getByRole('textbox', { name: 'Code' }).hasAttribute('readonly')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Name' }).hasAttribute('readonly')).toBe(true);
    const colors = screen.getByRole('radiogroup', { name: 'Color' });
    expect(within(colors).getAllByRole('radio')).toHaveLength(20);
    expect(
      within(colors).getByRole('radio', { name: 'Color 3' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(within(colors).getByRole('radio', { name: 'Color 1, used by HEAT' })).toBeTruthy();
    expect(within(colors).getByRole('radio', { name: 'Color 8, used by ASM' })).toBeTruthy();
    expect(
      screen.getByText(
        'One of the 20 palette colors. The color you set here stays: the import never replaces an existing color. Two groups can share a color; the name tells them apart.',
      ),
    ).toBeTruthy();

    await userEvent.click(within(colors).getByRole('radio', { name: 'Color 12' }));
    expect(
      within(colors).getByRole('radio', { name: 'Color 12' }).getAttribute('aria-checked'),
    ).toBe('true');
    const preview = screen.getByRole('figure', { name: 'Machining on the board' });
    expect(preview.querySelector('[style*="palette-12"]')).not.toBeNull();
    expect(preview.querySelector('[style*="palette-3"]')).toBeNull();

    expect(
      screen.getByRole('button', { name: 'Save equipment group' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByText('Saving waits for the equipment API; this form reads the fixture G1.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(mach);
  });

  it('#729 EG5 lets a plant admin rename a group created in NorthMES', async () => {
    renderCoreAt(coreLinks.equipmentGroups.group.edit({ plant, groupCode: 'ASM' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group ASM' });
    const name = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(name.value).toBe('Assembly');
    expect(name.hasAttribute('readonly')).toBe(false);
  });

  it('#729 EG5 picks a color by keyboard and recolors the preview', async () => {
    renderCoreAt(editMach, []);
    const colors = await screen.findByRole('radiogroup', { name: 'Color' });
    within(colors).getByRole('radio', { name: 'Color 3' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(
        within(colors).getByRole('radio', { name: 'Color 4' }).getAttribute('aria-checked'),
      ).toBe('true'),
    );
    const preview = screen.getByRole('figure', { name: 'Machining on the board' });
    expect(preview.querySelector('[style*="palette-4"]')).not.toBeNull();
  });

  it('#729 EG5 previews the name a plant admin types for a group created in NorthMES', async () => {
    renderCoreAt(coreLinks.equipmentGroups.group.edit({ plant, groupCode: 'ASM' }).href, []);
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Final assembly');
    expect(screen.getByRole('figure', { name: 'Final assembly on the board' })).toBeTruthy();
  });

  it('#729 EG5 says a change to a company group reaches every plant of the company', async () => {
    renderCoreAt(coreLinks.equipmentGroups.group.edit({ plant, groupCode: 'HEAT' }).href, []);
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group HEAT' });
    expect(
      screen.getByText('HEAT is a company group: a change here applies at every plant of Acme AB.'),
    ).toBeTruthy();
  });

  it('#729 EG5 shows the loading, failed, not-found and no-access states of the form', async () => {
    renderCoreAt(withSearch(editMach, { preview: 'loading' }), []);
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group MACH' });
    expect(screen.getByText('Loading the equipment group.')).toBeTruthy();

    cleanup();
    renderCoreAt(withSearch(editMach, { preview: 'error' }), []);
    await screen.findByRole('heading', { level: 2, name: 'Could not load the equipment group' });

    cleanup();
    renderCoreAt(coreLinks.equipmentGroups.group.edit({ plant, groupCode: 'NOPE' }).href, []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'This equipment group does not exist or you cannot see it',
    });

    cleanup();
    renderCoreAt(withSearch(editMach, { preview: 'forbidden' }), []);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to manage the settings of this plant',
    });
    expect(
      screen.getByRole('link', { name: 'Back to equipment group MACH' }).getAttribute('href'),
    ).toBe(mach);
  });
});
