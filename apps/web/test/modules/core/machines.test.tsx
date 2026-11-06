// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreEquipment } from '../../../src/modules/core/equipment.graphql.ts';
import { CoreEquipmentGroups } from '../../../src/modules/core/equipment-groups.graphql.ts';
import { CoreEquipmentList } from '../../../src/modules/core/equipment-list.graphql.ts';
import { CoreUpdateEquipment } from '../../../src/modules/core/screens/edit-machine/update-machine.graphql.ts';
import { CoreArchiveEquipment } from '../../../src/modules/core/screens/machine/archive-machine.graphql.ts';
import { CoreRestoreEquipment } from '../../../src/modules/core/screens/machine/restore-machine.graphql.ts';
import { CoreCreateEquipment } from '../../../src/modules/core/screens/new-machine/create-machine.graphql.ts';
import { companiesQuery, viewerQuery } from './access-fixtures.ts';
import {
  answeredAfter,
  holdRequests,
  lastChanged,
  plant,
  renderCoreAt,
  spoken,
} from './core-app.tsx';
import {
  asm,
  asm1,
  cnc1,
  cnc2,
  forbidden,
  g1Machines,
  groupQuery,
  groupsQuery,
  heat,
  lathe1,
  mach,
  machine,
  machineQuery,
  machinesQuery,
  mill1,
} from './equipment-fixtures.ts';

afterEach(cleanup);

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td')).map((cell) => cell.textContent ?? ''),
  );
}

/** The codes of the machines list's rows, in their order. */
function machineRows(): string[] {
  return Array.from(document.querySelectorAll('[data-machine]')).map(
    (row) => row.getAttribute('data-machine') ?? '',
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

/** The textbox named label. */
function field(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement;
}

/** Every machine permission at the plant, and with groups the permission to create a group. */
function admin(groups = false): MockLink.MockedResponse {
  return viewerQuery([
    ...['read', 'create', 'update', 'archive'].map((action) => `core.equipment:${action}`),
    ...(groups ? ['core.equipmentGroup:read', 'core.equipmentGroup:create'] : []),
  ]);
}

/** A mutation mock that records each input it receives and answers with `answer`. */
function recorded(
  query: MockLink.MockedResponse['request']['query'],
  sent: Record<string, unknown>[],
  answer: (input: Record<string, unknown>) => Record<string, unknown>,
): MockLink.MockedResponse {
  return {
    request: {
      query,
      variables: ({ input }: { input: Record<string, unknown> }) => {
        sent.push(input);
        return true;
      },
    },
    result: ({ input }: { input: Record<string, unknown> }) => ({ data: answer(input) }),
  } as MockLink.MockedResponse;
}

/** A mutation of `query` refused with the error code `errorCode`. */
function refused(
  query: MockLink.MockedResponse['request']['query'],
  errorCode: string,
  fieldErrors?: readonly { path: string[]; code: string; message: string }[],
): MockLink.MockedResponse {
  return {
    request: { query, variables: () => true },
    result: {
      errors: [
        new GraphQLError('Refused', {
          extensions: { code: 'BAD_REQUEST', errorCode, ...(fieldErrors && { fieldErrors }) },
        }),
      ],
    },
  } as MockLink.MockedResponse;
}

const machines = coreLinks.settings.machines({ plant }).href;
const pageOf = (id: string) => coreLinks.settings.machines.machine({ plant, equipmentId: id }).href;
const editOf = (id: string) =>
  coreLinks.settings.machines.machine.edit({ plant, equipmentId: id }).href;
const newMachine = coreLinks.settings.machines.new({ plant }).href;

describe('the machines list in plant settings (design #688, MA1 to MA9)', () => {
  it('#991 MA1 lists the machines by code with their group, plannable flag, calendar and the operations that allow them, under the equipment groups', async () => {
    renderCoreAt(machines, [machinesQuery(), companiesQuery(), admin(true)]);
    const table = await screen.findByRole('table', { name: 'Machines' });

    await waitFor(() =>
      expect(machineRows()).toEqual(['ASM1', 'CNC1', 'CNC2', 'LATHE1', 'LATHE2', 'MILL1']),
    );
    expect(statusLine()).toBe(
      '6 machines, 3 plannable, 2 equipment groups. Sorted by code. Allowed in counts the routing operations that may run on the machine.',
    );
    const rows = bodyRows(table);
    expect(rows[0]?.slice(0, 6)).toEqual([
      'ASM1',
      'Assembly bench',
      'Assembly',
      'No',
      'None',
      'No operations',
    ]);
    expect(rows[1]?.slice(0, 6)).toEqual([
      'CNC1',
      'CNC 1',
      'Machining',
      'Yes',
      'A1',
      '3 operations',
    ]);
    expect(rows[3]?.slice(0, 6)).toEqual([
      'LATHE1',
      'Lathe 1',
      'Machining',
      'No',
      'B3',
      'No operations',
    ]);
    expect(within(table).getByRole('link', { name: 'CNC1' }).getAttribute('href')).toBe(
      pageOf(cnc1.id),
    );
    // Edit shows once the user's permissions are in.
    expect(
      (await within(table).findByRole('link', { name: 'Edit CNC1' })).getAttribute('href'),
    ).toBe(editOf(cnc1.id));
    expect(within(table).getAllByRole('link', { name: 'A1' })[0]?.getAttribute('href')).toBe(
      '/plant-a/settings/calendars/A1',
    );
    const groups = screen.getByRole('region', { name: 'Equipment groups' });
    expect(within(groups).getByRole('link', { name: /^Machining/ }).textContent).toBe(
      'Machining MACH 5 machines',
    );
    expect(within(groups).getByRole('link', { name: /^Assembly/ }).textContent).toBe(
      'Assembly ASM 1 machine',
    );
    expect(
      within(groups).getByRole('link', { name: 'New equipment group' }).getAttribute('href'),
    ).toBe(coreLinks.settings.equipmentGroups.new({ plant }).href);
    expect(screen.getByRole('link', { name: 'New machine' }).getAttribute('href')).toBe(newMachine);
    expect(
      screen.getByText(
        'Calendars, routing operations and job orders show the fixture G1 until they have their API.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/ERP data as of/)).toBeNull();
  });

  it('#991 MA1 offers Edit and New machine only to a user who may change and create machines', async () => {
    renderCoreAt(
      machines,
      [viewerQuery(['core.equipment:read']), machinesQuery([cnc1]), companiesQuery()],
      { hold: answeredAfter('CoreViewer', 'CoreEquipmentList') },
    );
    const table = await screen.findByRole('table', { name: 'Machines' });
    await waitFor(() => expect(machineRows()).toEqual(['CNC1']));
    expect(within(table).queryByRole('link', { name: 'Edit CNC1' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New machine' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New equipment group' })).toBeNull();
  });

  it('#991 MA1 reads every page of the machines, past the first', async () => {
    renderCoreAt(machines, [
      machinesQuery([asm1, cnc1], false, { next: 'page-2' }),
      machinesQuery([cnc2], false, { after: 'page-2' }),
      companiesQuery(),
      admin(),
    ]);
    await screen.findByRole('table', { name: 'Machines' });
    await waitFor(() => expect(machineRows()).toEqual(['ASM1', 'CNC1', 'CNC2']));
  });

  it('#991 MA6 the empty list asks only a user who may create machines to create the first', async () => {
    renderCoreAt(
      machines,
      [viewerQuery(['core.equipment:read']), machinesQuery([]), companiesQuery()],
      { hold: answeredAfter('CoreViewer', 'CoreEquipmentList') },
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'No machines yet' })).toBeTruthy();
    expect(screen.getByText('A plant admin creates the machines here.')).toBeTruthy();
  });

  it('#991 MA1 a later page of machines that fails to load says so with Try again', async () => {
    renderCoreAt(machines, [
      machinesQuery([asm1, cnc1], false, { next: 'page-2' }),
      {
        request: {
          query: CoreEquipmentList,
          variables: { includeArchived: false, after: 'page-2' },
        },
        error: new Error('Network down'),
      },
      companiesQuery(),
      admin(),
    ]);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not load machines' }),
    ).toBeTruthy();
    // The status line never counts the first page alone as the plant's machines.
    expect(statusLine()).not.toMatch(/^2 machines/);
  });

  it('#991 MA1 a machine whose group the user cannot read shows Not shown, and the Group menu offers no empty option', async () => {
    renderCoreAt(machines, [
      machinesQuery([{ ...cnc1, group: null }, cnc2]),
      companiesQuery(),
      admin(),
    ]);
    const table = await screen.findByRole('table', { name: 'Machines' });
    await waitFor(() => expect(machineRows()).toEqual(['CNC1', 'CNC2']));
    expect(bodyRows(table)[0]?.[2]).toBe('Not shown');
    await userEvent.click(screen.getByRole('button', { name: 'Group' }));
    expect(screen.getAllByRole('menuitemcheckbox').map((item) => item.textContent?.trim())).toEqual(
      ['Machining 1'],
    );
  });

  it('#991 MA1 Plannable only, the Group filter and the search live in the URL', async () => {
    const router = renderCoreAt(machines, [machinesQuery(), companiesQuery(), admin()]);
    await screen.findByRole('table', { name: 'Machines' });
    await waitFor(() => expect(machineRows()).toHaveLength(6));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Plannable only' }));
    await waitFor(() => expect(machineRows()).toEqual(['CNC1', 'CNC2', 'MILL1']));
    expect(router.state.location.search).toEqual({ plannable: 1 });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Plannable only' }));

    await userEvent.click(screen.getByRole('button', { name: 'Group' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /^Assembly/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(machineRows()).toEqual(['ASM1']));
    expect(router.state.location.search).toEqual({ group: 'ASM' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(machineRows()).toHaveLength(6));

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search machines' }), 'mill');
    await waitFor(() => expect(machineRows()).toEqual(['MILL1']));
    expect(router.state.location.search).toEqual({ q: 'mill' });
  });

  it('#991 MA1 a picked group that no row has keeps its name in the chip and its checked item in the menu', async () => {
    // The assembly bench is the only machine of Assembly and is not plannable.
    renderCoreAt(`${machines}?group=ASM&plannable=1`, [machinesQuery(), companiesQuery(), admin()]);
    await screen.findByRole('heading', { level: 2, name: 'No machines match these filters' });

    expect(screen.getByText('Group:').parentElement?.textContent).toBe('Group: Assembly 0');
    await userEvent.click(screen.getByRole('button', { name: 'Group, 1 selected' }));
    const item = screen.getByRole('menuitemcheckbox', { name: /^Assembly/ });
    expect(item.getAttribute('aria-checked')).toBe('true');
  });

  it('#991 MA1 Show archived lives in the URL as archived=1 and lists the archived machines with the Archived badge', async () => {
    const old = machine('OLD1', 'Old press', mach, { archivedAt: lastChanged });
    const router = renderCoreAt(machines, [
      machinesQuery([cnc1]),
      machinesQuery([cnc1, old], true),
      companiesQuery(),
      admin(),
    ]);
    await screen.findByRole('table', { name: 'Machines' });
    await waitFor(() => expect(machineRows()).toEqual(['CNC1']));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await waitFor(() => expect(machineRows()).toEqual(['CNC1', 'OLD1']));
    expect(router.state.location.search).toEqual({ archived: 1 });
    const table = screen.getByRole('table', { name: 'Machines' });
    expect(bodyRows(table)[1]?.[1]).toBe('Old pressArchived');
    expect(within(table).queryByRole('link', { name: 'Edit OLD1' })).toBeNull();
  });

  it('#991 MA5 to MA8 show the loading, empty, failed and no-access states', async () => {
    const held = holdRequests((operation) => operation.operationName === 'CoreEquipmentList');
    renderCoreAt(machines, [machinesQuery([]), companiesQuery(), admin()], { hold: held.link });
    const table = await screen.findByRole('table', { name: 'Machines' });
    expect(table.getAttribute('aria-busy')).toBe('true');
    held.release();
    expect(await screen.findByRole('heading', { level: 2, name: 'No machines yet' })).toBeTruthy();
    expect(
      screen.getByText(
        'Create the first machine here. Every machine belongs to an equipment group.',
      ),
    ).toBeTruthy();
    cleanup();

    renderCoreAt(machines, [
      {
        request: { query: CoreEquipmentList, variables: { includeArchived: false } },
        error: new Error('Network down'),
      },
      companiesQuery(),
      admin(),
    ]);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not load machines' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    cleanup();

    renderCoreAt(machines, [
      forbidden({ query: CoreEquipmentList, variables: { includeArchived: false } }),
      companiesQuery(),
      viewerQuery([]),
    ]);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You need the permission to read machines in Plant A',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe("a machine's page (design #688, MA3)", () => {
  it('#991 MA3 shows the machine, its group, the routing operations that allow it and its job orders this week', async () => {
    renderCoreAt(pageOf(cnc1.id), [machineQuery(cnc1), companiesQuery(), admin()]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Machine CNC1' })).toBeTruthy();
    await screen.findByText('Code', { selector: 'dt' });
    expect(screen.getByText('CNC 1, Machining')).toBeTruthy();
    expect(definition('Code')).toBe('CNC1');
    expect(definition('Name')).toBe('CNC 1');
    expect(definition('Equipment group')).toContain('Machining');
    expect(screen.getByRole('link', { name: 'Machining' }).getAttribute('href')).toBe(
      coreLinks.settings.equipmentGroups.group({ plant, groupId: mach.id }).href,
    );
    expect(definition('Plannable')).toContain('Yes');
    expect(definition('Calendar')).toContain('A1');
    expect(definition('Calendar')).toContain(
      'Mon to Fri 06:00 to 15:00, breaks 08:30 to 08:45 and 11:00 to 11:30.',
    );
    expect(definition('Color stripe')).toContain('From the group, Color 3');

    const allowed = screen.getByRole('table', { name: 'Routing operations that may run on CNC 1' });
    expect(bodyRows(allowed)).toEqual([
      ['Bracket L', '10 Turn', 'CNC 2', '1001, 1005'],
      ['Gear blank 32', '10 Turn', 'None, only machine', '1003'],
      ['Hub 12', '10 Turn', 'None, only machine', '1004'],
    ]);
    const week = screen.getByRole('table', {
      name: 'Job orders on CNC 1 in W45, Mon 2 Nov to Sun 8 Nov',
    });
    expect(bodyRows(week).map((row) => row[0])).toEqual([
      '1001.10 Turn',
      '1003.10 Turn',
      '1004.10 Turn',
    ]);
    expect(screen.getByRole('link', { name: 'Show on board' }).getAttribute('href')).toBe(
      '/plant-a/planning/board?zoom=week&from=2026-11-02',
    );
    expect(screen.getByRole('link', { name: 'Edit machine' }).getAttribute('href')).toBe(
      editOf(cnc1.id),
    );
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(
      screen.getByText(
        'Calendars, routing operations and job orders show the fixture G1 until they have their API.',
      ),
    ).toBeTruthy();
  });

  it('#991 MA3 a machine the fixture does not know is on the plant calendar with an empty week, and its own color shows', async () => {
    const press = machine('PRESS9', 'Press 9', asm, { isPlannable: false, color: 'palette-5' });
    renderCoreAt(pageOf(press.id), [machineQuery(press), companiesQuery(), admin()]);
    await screen.findByText('Plannable', { selector: 'dt' });

    expect(definition('Plannable')).toContain('No');
    expect(definition('Calendar')).toContain('A1');
    expect(definition('Calendar')).toContain('The plant calendar by default.');
    expect(definition('Color stripe')).toContain('Color 5, its own');
    expect(screen.getByText('No routing operation names this machine.')).toBeTruthy();
    expect(screen.getByText('No job order on this machine this week.')).toBeTruthy();
  });

  it('#991 MA3 an unknown id and an old link by code show the not-found state, the code without asking the API', async () => {
    renderCoreAt(pageOf(cnc1.id), [machineQuery(cnc1, null), companiesQuery(), admin()]);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'This machine does not exist or you cannot see it',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Machines' }).getAttribute('href')).toBe(
      machines,
    );
    cleanup();

    renderCoreAt(pageOf('CNC1'), [companiesQuery(), admin()]);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'This machine does not exist or you cannot see it',
      }),
    ).toBeTruthy();
  });

  it('#991 MA3 shows the failed and no-access states', async () => {
    renderCoreAt(pageOf(cnc1.id), [
      {
        request: { query: CoreEquipment, variables: { id: cnc1.id } },
        error: new Error('Network down'),
      },
      companiesQuery(),
      admin(),
    ]);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not load the machine' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    cleanup();

    renderCoreAt(pageOf(cnc1.id), [
      forbidden({ query: CoreEquipment, variables: { id: cnc1.id } }),
      companiesQuery(),
      viewerQuery([]),
    ]);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You need the permission to read machines in Plant A',
      }),
    ).toBeTruthy();
  });

  it('#991 MA3 offers neither Edit machine nor Archive to a user who may only read machines', async () => {
    renderCoreAt(
      pageOf(cnc1.id),
      [viewerQuery(['core.equipment:read']), machineQuery(cnc1), companiesQuery()],
      { hold: answeredAfter('CoreViewer', 'CoreEquipment') },
    );
    await screen.findByRole('heading', { level: 1, name: 'Machine CNC1' });
    expect(screen.queryByRole('link', { name: 'Edit machine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  it('#991 MA3 Archive asks first, archives the machine with its version and says so; the archived machine offers Restore', async () => {
    const user = userEvent.setup();
    const archived = { ...cnc1, version: 2, archivedAt: lastChanged };
    renderCoreAt(pageOf(cnc1.id), [
      machineQuery(cnc1),
      companiesQuery(),
      admin(),
      {
        request: {
          query: CoreArchiveEquipment,
          variables: { input: { id: cnc1.id, expectedVersion: 1 } },
        },
        result: { data: { coreArchiveEquipment: archived } },
      },
      {
        request: {
          query: CoreRestoreEquipment,
          variables: { input: { id: cnc1.id, expectedVersion: 2 } },
        },
        result: { data: { coreRestoreEquipment: { ...cnc1, version: 3 } } },
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Archive machine CNC1?' });
    expect(within(dialog).getByText(/hidden from the list/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Archive machine' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await screen.findByText('Archived')).toBeTruthy();
    await waitFor(() => expect(spoken()).toBe('Machine CNC1 archived'));
    expect(screen.queryByRole('link', { name: 'Edit machine' })).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    const restore = await screen.findByRole('alertdialog', { name: 'Restore machine CNC1?' });
    await user.click(within(restore).getByRole('button', { name: 'Restore machine' }));
    await waitFor(() => expect(spoken()).toBe('Machine CNC1 restored'));
  });
});

describe("a machine's edit form (design #688, MA4)", () => {
  it('#991 MA4 keeps the code, offers the active groups, and saves the name, group, plannable flag and color stripe with the version', async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];
    const router = renderCoreAt(editOf(cnc1.id), [
      machineQuery(cnc1),
      groupsQuery([asm, heat, mach]),
      companiesQuery(),
      admin(),
      recorded(CoreUpdateEquipment, sent, () => ({
        coreUpdateEquipment: { ...cnc1, name: 'CNC 1 hall', version: 2 },
      })),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Edit machine CNC1' });

    expect((await screen.findByRole('textbox', { name: 'Code' })).hasAttribute('readonly')).toBe(
      true,
    );
    expect(field('Name').value).toBe('CNC 1');
    const groupField = screen.getByRole('combobox', {
      name: 'Equipment group',
    }) as HTMLSelectElement;
    await waitFor(() =>
      expect(Array.from(groupField.options).map((option) => option.textContent)).toEqual([
        'Choose a group',
        'Assembly (ASM)',
        'Heat treatment (HEAT)',
        'Machining (MACH)',
      ]),
    );
    expect(groupField.value).toBe(mach.id);
    const plannable = screen.getByRole('checkbox', { name: /^Plannable/ });
    expect(plannable.getAttribute('aria-checked')).toBe('true');
    const stripe = screen.getByRole('radiogroup', { name: 'Color stripe' });
    expect(
      within(stripe)
        .getByRole('radio', { name: 'From the group, Machining' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.queryByRole('radiogroup', { name: 'Own color' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(pageOf(cnc1.id));

    await user.clear(field('Name'));
    await user.type(field('Name'), 'CNC 1 hall ');
    await user.selectOptions(groupField, heat.id);
    await user.click(plannable);
    await user.click(within(stripe).getByRole('radio', { name: 'Own color' }));
    const own = screen.getByRole('radiogroup', { name: 'Own color' });
    expect(within(own).getAllByRole('radio')).toHaveLength(20);
    await user.click(within(own).getByRole('radio', { name: 'Color 5' }));
    await user.click(screen.getByRole('button', { name: 'Save machine' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(pageOf(cnc1.id)));
    expect(sent).toEqual([
      {
        id: cnc1.id,
        expectedVersion: 1,
        code: 'CNC1',
        name: 'CNC 1 hall',
        groupId: heat.id,
        isPlannable: false,
        color: 'palette-5',
      },
    ]);
    await waitFor(() => expect(spoken()).toBe('Machine CNC1 saved'));
  });

  it("#991 MA4 From the group sends group, so a machine with its own color takes its group's again", async () => {
    const user = userEvent.setup();
    const own = { ...lathe1, color: 'palette-9' };
    const sent: Record<string, unknown>[] = [];
    renderCoreAt(editOf(own.id), [
      machineQuery(own),
      groupsQuery([mach]),
      companiesQuery(),
      admin(),
      recorded(CoreUpdateEquipment, sent, () => ({
        coreUpdateEquipment: { ...own, color: null, version: 2 },
      })),
    ]);
    const stripe = await screen.findByRole('radiogroup', { name: 'Color stripe' });
    const ownColors = screen.getByRole('radiogroup', { name: 'Own color' });
    expect(
      within(ownColors).getByRole('radio', { name: 'Color 9' }).getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(within(stripe).getByRole('radio', { name: 'From the group, Machining' }));
    await user.click(screen.getByRole('button', { name: 'Save machine' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ color: 'group', isPlannable: false });
  });

  it('#991 MA4 a save refused for a newer version keeps the entries and offers Reload, which fills the form with the saved machine', async () => {
    const user = userEvent.setup();
    const saved = { ...cnc1, name: 'CNC 1 east', version: 2 };
    const sent: Record<string, unknown>[] = [];
    renderCoreAt(editOf(cnc1.id), [
      machineQuery(cnc1),
      groupsQuery([mach]),
      companiesQuery(),
      admin(),
      refused(CoreUpdateEquipment, 'core.version_conflict'),
      machineQuery(cnc1, saved),
      recorded(CoreUpdateEquipment, sent, () => ({
        coreUpdateEquipment: { ...saved, version: 3 },
      })),
    ]);
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'CNC 1 hall');
    await user.click(screen.getByRole('button', { name: 'Save machine' }));

    const reload = await screen.findByRole('button', { name: /Reload/ });
    expect(field('Name').value).toBe('CNC 1 hall');
    await user.click(reload);
    await waitFor(() => expect(field('Name').value).toBe('CNC 1 east'));
    await user.click(screen.getByRole('button', { name: 'Save machine' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ expectedVersion: 2, name: 'CNC 1 east' });
  });

  it('#991 MA4 a group the API refuses lands on Equipment group, and the entries stay', async () => {
    const user = userEvent.setup();
    renderCoreAt(editOf(cnc1.id), [
      machineQuery(cnc1),
      groupsQuery([asm, mach]),
      companiesQuery(),
      admin(),
      refused(CoreUpdateEquipment, 'core.equipment_group_not_active', [
        {
          path: ['groupId'],
          code: 'core.equipment_group_not_active',
          message: 'Assembly is archived. Choose an active group.',
        },
      ]),
    ]);
    const groupField = (await screen.findByRole('combobox', {
      name: 'Equipment group',
    })) as HTMLSelectElement;
    await waitFor(() => expect(groupField.options).toHaveLength(3));
    await user.selectOptions(groupField, asm.id);
    await user.click(screen.getByRole('button', { name: 'Save machine' }));

    await waitFor(() => expect(groupField.getAttribute('aria-invalid')).toBe('true'));
    expect(
      document.getElementById(groupField.getAttribute('aria-describedby')?.split(' ')[0] ?? '')
        ?.textContent,
    ).toBe('Assembly is archived. Choose an active group.');
    expect(groupField.value).toBe(asm.id);
  });

  it('#991 MA4 shows a machine the user may not change read-only, without Save, and an archived one with why', async () => {
    renderCoreAt(
      editOf(cnc1.id),
      [
        viewerQuery(['core.equipment:read']),
        machineQuery(cnc1),
        groupsQuery([mach]),
        companiesQuery(),
      ],
      { hold: answeredAfter('CoreViewer', 'CoreEquipment') },
    );
    await screen.findByRole('heading', { level: 1, name: 'Edit machine CNC1' });
    expect(field('Name').hasAttribute('readonly')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save machine' })).toBeNull();
    expect(screen.getByText('You may read this machine but not change it.')).toBeTruthy();
    cleanup();

    const archived = { ...mill1, archivedAt: lastChanged };
    renderCoreAt(editOf(archived.id), [
      machineQuery(archived),
      groupsQuery([mach]),
      companiesQuery(),
      admin(),
    ]);
    expect(
      await screen.findByText('MILL1 is archived. Restore it on its page to change it.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save machine' })).toBeNull();
  });

  it('#991 MF1 to MF2 shows the loading and not-found states of the form', async () => {
    const held = holdRequests((operation) => operation.operationName === 'CoreEquipment');
    renderCoreAt(editOf(cnc1.id), [machineQuery(cnc1, null), companiesQuery(), admin()], {
      hold: held.link,
    });
    expect(await screen.findByText('Loading the machine.')).toBeTruthy();
    held.release();
    await screen.findByRole('heading', {
      level: 2,
      name: 'This machine does not exist or you cannot see it',
    });
  });
});

describe('a new machine (design #688)', () => {
  it('#991 New machine creates a plannable machine in the picked group with the trimmed code and name, then opens its page', async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];
    const press = machine('PRESS9', 'Press 9', asm);
    const router = renderCoreAt(newMachine, [
      groupsQuery([asm, mach]),
      companiesQuery(),
      admin(),
      recorded(CoreCreateEquipment, sent, (input) => ({
        coreCreateEquipment: { ...press, id: input.id },
      })),
    ]);
    expect(
      (await screen.findByRole('checkbox', { name: /^Plannable/ })).getAttribute('aria-checked'),
    ).toBe('true');

    await user.type(field('Code'), ' PRESS9 ');
    await user.type(field('Name'), 'Press 9 ');
    const groupField = screen.getByRole('combobox', { name: 'Equipment group' });
    await waitFor(() => expect((groupField as HTMLSelectElement).options).toHaveLength(3));
    await user.selectOptions(groupField, asm.id);
    expect(
      screen.getByRole('radio', { name: 'From the group, Assembly' }).getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Save machine' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/settings\/machines\/[0-9a-f-]{36}$/),
    );
    expect(sent).toEqual([
      {
        id: expect.any(String),
        code: 'PRESS9',
        name: 'Press 9',
        groupId: asm.id,
        isPlannable: true,
        color: 'group',
      },
    ]);
    expect(router.state.location.pathname).toBe(pageOf(String(sent[0]?.id)));
    await waitFor(() => expect(spoken()).toBe('Machine PRESS9 created'));
    // The page opens on the answer the create wrote into the cache.
    expect(await screen.findByRole('heading', { level: 1, name: 'Machine PRESS9' })).toBeTruthy();
  });

  it('#991 New machine asks for a group before it sends', async () => {
    const user = userEvent.setup();
    renderCoreAt(newMachine, [groupsQuery([mach]), companiesQuery(), admin()]);
    await user.type(await screen.findByRole('textbox', { name: 'Code' }), 'PRESS9');
    await user.type(field('Name'), 'Press 9');
    await user.click(screen.getByRole('button', { name: 'Save machine' }));
    expect(
      (await screen.findAllByText('Choose the equipment group of the machine.')).length,
    ).toBeGreaterThan(0);
  });

  it('#991 New machine puts a taken code on Code and keeps the entries', async () => {
    const user = userEvent.setup();
    renderCoreAt(newMachine, [
      groupsQuery([mach]),
      companiesQuery(),
      admin(),
      refused(CoreCreateEquipment, 'core.code_taken', [
        { path: ['code'], code: 'core.code_taken', message: 'taken' },
      ]),
    ]);
    await user.type(await screen.findByRole('textbox', { name: 'Code' }), 'CNC1');
    await user.type(field('Name'), 'CNC 1 again');
    const groupField = screen.getByRole('combobox', { name: 'Equipment group' });
    await waitFor(() => expect((groupField as HTMLSelectElement).options).toHaveLength(2));
    await user.selectOptions(groupField, mach.id);
    await user.click(screen.getByRole('button', { name: 'Save machine' }));

    await waitFor(() => expect(field('Code').getAttribute('aria-invalid')).toBe('true'));
    expect(
      (await screen.findAllByText('Code CNC1 is already in use here. Choose another code.')).length,
    ).toBeGreaterThan(0);
    expect(field('Code').value).toBe('CNC1');
  });

  it('#991 New machine says so when the equipment groups cannot be read, with Try again', async () => {
    renderCoreAt(newMachine, [
      forbidden({ query: CoreEquipmentGroups, variables: { includeArchived: false } }),
      companiesQuery(),
      viewerQuery(['core.equipment:read', 'core.equipment:create']),
    ]);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Could not open New machine' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('#991 New machine says so to a user who may not create machines', async () => {
    renderCoreAt(newMachine, [viewerQuery(['core.equipment:read']), companiesQuery()]);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You need the permission to create machines in Plant A',
      }),
    ).toBeTruthy();
  });
});

describe('the machines of an equipment group (design #729, EG4)', () => {
  it('#991 EG1 EG4 a user who reads groups but not machines sees the groups, without their machines', async () => {
    const refusedMachines = forbidden({
      query: CoreEquipmentList,
      variables: { includeArchived: false },
    });
    renderCoreAt(coreLinks.settings.equipmentGroups({ plant }).href, [
      groupsQuery([mach]),
      refusedMachines,
      companiesQuery(),
      viewerQuery(['core.equipmentGroup:read']),
    ]);
    const list = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });
    await waitFor(() => expect(bodyRows(list)[0]?.[4]).toBe('Not shown'));
    expect(statusLine()).toBe('1 equipment group. Sorted by code.');
    cleanup();

    renderCoreAt(coreLinks.settings.equipmentGroups.group({ plant, groupId: mach.id }).href, [
      groupQuery(mach),
      refusedMachines,
      companiesQuery(),
      viewerQuery(['core.equipmentGroup:read']),
    ]);
    expect(
      await screen.findByText(
        'You cannot see the machines at Plant A: that needs core.equipment:read.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Machines in MACH' })).toBeNull();
    // The band would claim the group has no plannable machine, which nobody knows here.
    expect(screen.queryByRole('heading', { name: 'On the board' })).toBeNull();
  });

  it("#991 EG4 a group's page lists its machines at the plant from the API, each a link to its page", async () => {
    const groupPage = coreLinks.settings.equipmentGroups.group({ plant, groupId: mach.id }).href;
    renderCoreAt(groupPage, [
      groupQuery(mach),
      machinesQuery(g1Machines.filter((each) => each.code !== 'LATHE2')),
      companiesQuery(),
      viewerQuery(['core.equipmentGroup:read']),
    ]);
    const table = await screen.findByRole('table', { name: 'Machines in MACH' });
    expect(bodyRows(table).map((row) => row[0])).toEqual(['CNC1', 'CNC2', 'LATHE1', 'MILL1']);
    expect(within(table).getByRole('link', { name: 'CNC1' }).getAttribute('href')).toBe(
      pageOf(cnc1.id),
    );
  });
});
