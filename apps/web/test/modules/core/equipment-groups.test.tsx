// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreEquipmentGroup } from '../../../src/modules/core/equipment-group.graphql.ts';
import { CoreEquipmentGroups } from '../../../src/modules/core/equipment-groups.graphql.ts';
import { CoreUpdateEquipmentGroup } from '../../../src/modules/core/screens/edit-equipment-group/update-equipment-group.graphql.ts';
import { CoreArchiveEquipmentGroup } from '../../../src/modules/core/screens/equipment-group/archive-equipment-group.graphql.ts';
import { CoreRestoreEquipmentGroup } from '../../../src/modules/core/screens/equipment-group/restore-equipment-group.graphql.ts';
import { CoreCreateEquipmentGroup } from '../../../src/modules/core/screens/new-equipment-group/create-equipment-group.graphql.ts';
import { companiesQuery, viewerQuery } from './access-fixtures.ts';
import {
  answeredAfter,
  holdRequests,
  lastChanged,
  plant,
  renderCoreAt,
  spoken,
} from './core-app.tsx';

afterEach(cleanup);

/** The text of each cell of a table's own body rows. */
function bodyRows(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll(':scope > tbody > tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > td:not([aria-hidden])')).map(
      (cell) => cell.textContent ?? '',
    ),
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

type Group = ReturnType<typeof group>;

/**
 * A fictional equipment group with an id made from its code, at the plant unless scope says the
 * company, active unless archivedAt says otherwise. Its codes are those of the fixture G1, so the
 * pages find G1's machines in it.
 */
function group(
  code: string,
  name: string,
  {
    scope = 'plant',
    color = 'palette-1',
    colorFrom = 'set',
    version = 1,
    archivedAt = null,
  }: {
    scope?: 'company' | 'plant';
    color?: string;
    colorFrom?: 'erp' | 'set' | 'palette';
    version?: number;
    archivedAt?: string | null;
  } = {},
) {
  const digits = [...code].map((char) => char.charCodeAt(0).toString(16)).join('');
  return {
    __typename: 'EquipmentGroup' as const,
    id: `019a0000-0000-7000-8000-${digits.padStart(12, '0').slice(-12)}`,
    code,
    name,
    color,
    colorFrom,
    scope,
    version,
    archivedAt,
    updatedAt: lastChanged,
  };
}

const asm = group('ASM', 'Assembly', { color: 'palette-8' });
const heat = group('HEAT', 'Heat treatment', { scope: 'company', colorFrom: 'palette' });
const mach = group('MACH', 'Machining', { color: 'palette-3', colorFrom: 'erp' });

/**
 * coreEquipmentGroups, with or without the archived ones, answered with these groups: the first
 * page, or with `after` and `next` the page after that cursor and the cursor of the page after it.
 */
function groupsQuery(
  groups: readonly Group[],
  includeArchived = false,
  { after, next }: { after?: string; next?: string } = {},
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreEquipmentGroups,
      variables: after === undefined ? { includeArchived } : { includeArchived, after },
    },
    result: {
      data: {
        coreEquipmentGroups: {
          __typename: 'EquipmentGroupConnection',
          totalCount: groups.length,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: next !== undefined,
            endCursor: next ?? null,
          },
          edges: groups.map((node) => ({ __typename: 'EquipmentGroupEdge', node })),
        },
      },
    },
  };
}

/** coreEquipmentGroup for the group's id, answered with it, or null for an unknown id. */
function groupQuery(found: Group, answer: Group | null = found): MockLink.MockedResponse {
  return {
    request: { query: CoreEquipmentGroup, variables: { id: found.id } },
    result: { data: { coreEquipmentGroup: answer } },
  };
}

/** A query of `query` refused with FORBIDDEN, as the API answers a user without the permission. */
function forbidden(request: MockLink.MockedResponse['request']): MockLink.MockedResponse {
  return {
    request,
    result: {
      errors: [
        new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
        }),
      ],
    },
  };
}

/** Every equipment group permission at the plant, and at the company with company. */
function admin(company = false): MockLink.MockedResponse {
  const all = ['read', 'create', 'update', 'archive'].map(
    (action) => `core.equipmentGroup:${action}`,
  );
  return viewerQuery(all, company ? all : []);
}

const groups = coreLinks.settings.equipmentGroups({ plant }).href;
const machPage = coreLinks.settings.equipmentGroups.group({ plant, groupId: mach.id }).href;
const editMach = coreLinks.settings.equipmentGroups.group.edit({ plant, groupId: mach.id }).href;
const newGroup = coreLinks.settings.equipmentGroups.new({ plant }).href;

describe('the equipment groups in plant settings (design #729, EG1 to EG9)', () => {
  it("#983 EG1 lists the groups the plant sees by code with their color, scope, the plant's machines in them and where the color came from", async () => {
    renderCoreAt(groups, [groupsQuery([asm, heat, mach]), companiesQuery(), admin(true)]);
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });

    await waitFor(() =>
      expect(bodyRows(table)).toEqual([
        ['Color 8', 'ASM', 'Assembly', 'Plant A', '1 machineAssembly bench', 'Set here', 'Edit'],
        [
          'Color 1',
          'HEAT',
          'Heat treatment',
          'Acme AB',
          'No machines at Plant A',
          'Assigned from the palette',
          'Edit',
        ],
        [
          'Color 3',
          'MACH',
          'Machining',
          'Plant A',
          '5 machinesCNC 1, CNC 2, Lathe 1, Lathe 2, Mill 1',
          'From the ERP',
          'Edit',
        ],
      ]),
    );
    expect(statusLine()).toBe(
      '3 equipment groups, 6 machines. Sorted by code. HEAT is a company group with no machines at Plant A.',
    );
    expect(screen.getByRole('note').textContent).toBe(
      'A group keeps the color it has. A new group without a picked color takes the first of the 20 palette colors that no other group uses.',
    );
    expect(
      screen.getByText(
        'The machines in each group show the fixture G1 until the machine pages read the API.',
      ),
    ).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'MACH' }).getAttribute('href')).toBe(machPage);
    expect(within(table).getByRole('link', { name: 'Edit MACH' }).getAttribute('href')).toBe(
      editMach,
    );
    expect(screen.getByRole('link', { name: 'New equipment group' }).getAttribute('href')).toBe(
      newGroup,
    );
    expect(screen.getByRole('region', { name: 'Equipment groups, scrolls sideways' })).toBeTruthy();
  });

  it('#983 EG1 offers Edit only on the groups the user may change, and New equipment group only to a holder of core.equipmentGroup:create', async () => {
    renderCoreAt(
      groups,
      [
        viewerQuery(['core.equipmentGroup:read', 'core.equipmentGroup:update']),
        groupsQuery([asm, heat]),
        companiesQuery(),
      ],
      { hold: answeredAfter('CoreViewer', 'CoreEquipmentGroups') },
    );
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });

    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(within(table).getByRole('link', { name: 'Edit ASM' })).toBeTruthy();
    expect(within(table).queryByRole('link', { name: 'Edit HEAT' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New equipment group' })).toBeNull();
  });

  it('#983 EG1 reads every page of the groups, past the first', async () => {
    renderCoreAt(groups, [
      groupsQuery([asm, heat], false, { next: 'page-2' }),
      groupsQuery([mach], false, { after: 'page-2' }),
      companiesQuery(),
      admin(),
    ]);
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });
    await waitFor(() =>
      expect(bodyRows(table).map((row) => row[1])).toEqual(['ASM', 'HEAT', 'MACH']),
    );
  });

  it('#983 EG1 filters by Scope through its menu and from the URL, with a chip and Clear filters that gives focus back to Scope', async () => {
    const router = renderCoreAt(groups, [
      groupsQuery([asm, heat, mach]),
      companiesQuery(),
      admin(),
    ]);
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));

    await userEvent.click(screen.getByRole('button', { name: 'Scope' }));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /^Acme AB/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.search).toEqual({ scope: 'company' }));
    expect(bodyRows(table).map((row) => row[1])).toEqual(['HEAT']);
    expect(statusLine()).toMatch(/^1 equipment group, 0 machines\./);
    await userEvent.click(screen.getByRole('button', { name: 'Remove the scope filter' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));

    await userEvent.click(screen.getByRole('button', { name: 'Scope' }));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /^Plant A/ }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyRows(table).map((row) => row[1])).toEqual(['ASM', 'MACH']));
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Scope' }));
  });

  it('#983 EG1 Show archived lists the archived groups too, each with the Archived badge', async () => {
    const old = group('OLD', 'Old line', { archivedAt: lastChanged });
    renderCoreAt(groups, [
      groupsQuery([asm]),
      groupsQuery([asm, old], true),
      companiesQuery(),
      admin(),
    ]);
    const table = await screen.findByRole('table', { name: 'Equipment groups of Plant A' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(1));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await waitFor(() => expect(bodyRows(table).map((row) => row[1])).toEqual(['ASM', 'OLD']));
    expect(bodyRows(table)[1]?.[2]).toBe('Old lineArchived');
    expect(within(table).queryByRole('link', { name: 'Edit OLD' })).toBeNull();
  });

  it('#983 EG6 to EG9 show the loading, empty, failed and no-access states', async () => {
    const held = holdRequests((operation) => operation.operationName === 'CoreEquipmentGroups');
    renderCoreAt(groups, [groupsQuery([]), companiesQuery(), admin()], { hold: held.link });
    expect(
      (await screen.findByRole('table', { name: 'Equipment groups' })).getAttribute('aria-busy'),
    ).toBe('true');
    held.release();

    await screen.findByRole('heading', { level: 2, name: 'No equipment groups yet' });
    expect(
      screen.getByText('Every machine on the board needs a group. Create the first one here.'),
    ).toBeTruthy();

    cleanup();
    renderCoreAt(groups, [
      {
        request: { query: CoreEquipmentGroups, variables: { includeArchived: false } },
        error: new Error('Network down'),
      },
      companiesQuery(),
      admin(),
    ]);
    await screen.findByRole('heading', { level: 2, name: 'Could not load equipment groups' });

    cleanup();
    renderCoreAt(groups, [
      forbidden({ query: CoreEquipmentGroups, variables: { includeArchived: false } }),
      companiesQuery(),
      viewerQuery([]),
    ]);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to read equipment groups in Plant A',
    });
    expect(screen.queryByRole('link', { name: 'New equipment group' })).toBeNull();
  });
});

describe("an equipment group's page (design #729, EG4)", () => {
  it('#983 EG4 shows MACH with its color from the ERP, its machines, and the band of its plannable machines it draws on the board', async () => {
    renderCoreAt(machPage, [groupQuery(mach), companiesQuery(), admin()]);
    await screen.findByRole('heading', { level: 1, name: 'Equipment group MACH' });

    await waitFor(() => expect(definition('Code')).toBe('MACH'));
    expect(definition('Name')).toBe('Machining');
    await waitFor(() => expect(definition('Scope')).toBe('Plant A'));
    expect(definition('Color')).toBe(
      'Color 3The ERP sent it with the first import. The group keeps it: a later import color does not replace it.',
    );
    expect(
      screen.getByText("5 machines at Plant A. A machine's group is set on the machine's page."),
    ).toBeTruthy();
    const machines = screen.getByRole('table', { name: 'Machines in MACH' });
    expect(bodyRows(machines)).toEqual([
      ['CNC1', 'CNC 1', 'Yes', 'A1'],
      ['CNC2', 'CNC 2', 'Yes', 'A1'],
      ['LATHE1', 'Lathe 1', 'No', 'B3'],
      ['LATHE2', 'Lathe 2', 'No', 'B3'],
      ['MILL1', 'Mill 1', 'Yes', 'A1'],
    ]);
    expect(screen.getByRole('figure', { name: 'Machining on the board' }).textContent).toBe(
      'Machining3 machinesCNC 1CNC 2Mill 1',
    );
    expect(
      (await screen.findByRole('link', { name: 'Edit equipment group' })).getAttribute('href'),
    ).toBe(editMach);
  });

  it('#983 EG4 says the company group HEAT took the first free palette color and has no machines here', async () => {
    renderCoreAt(coreLinks.settings.equipmentGroups.group({ plant, groupId: heat.id }).href, [
      groupQuery(heat),
      companiesQuery(),
      admin(),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Equipment group HEAT' });

    await waitFor(() =>
      expect(definition('Scope')).toBe(
        'Acme ABA company group: every plant of Acme AB may use it.',
      ),
    );
    expect(definition('Color')).toBe(
      'Color 1No color was picked, so the group took the first of the 20 palette colors that no other group used. The group keeps it.',
    );
    expect(
      screen.getByText("No machines at Plant A. A machine's group is set on the machine's page."),
    ).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Machines in HEAT' })).toBeNull();
    // A plant admin cannot change the company's group.
    expect(screen.queryByRole('link', { name: 'Edit equipment group' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  it('#983 EG4 says a group does not exist, with the way back, and shows the failed and no-access states', async () => {
    renderCoreAt(machPage, [groupQuery(mach, null), companiesQuery(), admin()]);
    await screen.findByRole('heading', {
      level: 2,
      name: 'This equipment group does not exist or you cannot see it',
    });
    expect(
      screen.getByRole('link', { name: 'Back to Equipment groups' }).getAttribute('href'),
    ).toBe(groups);

    cleanup();
    renderCoreAt(machPage, [
      {
        request: { query: CoreEquipmentGroup, variables: { id: mach.id } },
        error: new Error('Network down'),
      },
      companiesQuery(),
      admin(),
    ]);
    await screen.findByRole('heading', { level: 2, name: 'Could not load the equipment group' });

    cleanup();
    renderCoreAt(machPage, [
      forbidden({ query: CoreEquipmentGroup, variables: { id: mach.id } }),
      companiesQuery(),
      viewerQuery([]),
    ]);
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to read equipment groups in Plant A',
    });
  });

  it('#983 EG4 Archive asks first, archives the group with its version and says so; the archived group offers Restore', async () => {
    const user = userEvent.setup();
    const archived = { ...mach, version: 2, archivedAt: lastChanged };
    renderCoreAt(machPage, [
      groupQuery(mach),
      companiesQuery(),
      admin(),
      {
        request: {
          query: CoreArchiveEquipmentGroup,
          variables: { input: { id: mach.id, expectedVersion: 1 } },
        },
        result: { data: { coreArchiveEquipmentGroup: archived } },
      },
      {
        request: {
          query: CoreRestoreEquipmentGroup,
          variables: { input: { id: mach.id, expectedVersion: 2 } },
        },
        result: { data: { coreRestoreEquipmentGroup: { ...mach, version: 3 } } },
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Archive equipment group MACH?',
    });
    expect(within(dialog).getByText(/No machine can join an archived group/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Archive equipment group' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(await screen.findByText('Archived')).toBeTruthy();
    await waitFor(() => expect(spoken()).toBe('Equipment group MACH archived'));
    expect(screen.queryByRole('link', { name: 'Edit equipment group' })).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    const restore = await screen.findByRole('alertdialog', {
      name: 'Restore equipment group MACH?',
    });
    await user.click(within(restore).getByRole('button', { name: 'Restore equipment group' }));
    await waitFor(() => expect(spoken()).toBe('Equipment group MACH restored'));
  });

  it('#983 EG4 a refused archive keeps the dialog open with the reason', async () => {
    const user = userEvent.setup();
    renderCoreAt(machPage, [
      groupQuery(mach),
      companiesQuery(),
      admin(),
      {
        request: {
          query: CoreArchiveEquipmentGroup,
          variables: { input: { id: mach.id, expectedVersion: 1 } },
        },
        result: {
          errors: [
            new GraphQLError('Conflict', {
              extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
            }),
          ],
        },
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Archive equipment group MACH?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Archive equipment group' }));
    expect(
      await within(dialog).findByText(
        'Someone changed this equipment group after you opened it. Reload the page, then archive it again.',
      ),
    ).toBeTruthy();
  });
});

describe("an equipment group's edit form (design #729, EG5)", () => {
  it('#983 EG5 keeps the code, offers the 20 palette colors with the groups that use them, previews the band, and saves the name and color with the version', async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];
    const router = renderCoreAt(editMach, [
      groupQuery(mach),
      groupsQuery([asm, heat, mach]),
      companiesQuery(),
      admin(),
      {
        request: {
          query: CoreUpdateEquipmentGroup,
          variables: ({ input }: { input: Record<string, unknown> }) => {
            sent.push(input);
            return true;
          },
        },
        result: {
          data: {
            coreUpdateEquipmentGroup: {
              ...mach,
              name: 'Machining hall',
              color: 'palette-12',
              colorFrom: 'set',
              version: 2,
            },
          },
        },
      } as MockLink.MockedResponse,
      groupQuery({ ...mach, name: 'Machining hall', color: 'palette-12', version: 2 }),
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group MACH' });

    expect((await screen.findByRole('textbox', { name: 'Code' })).hasAttribute('readonly')).toBe(
      true,
    );
    const colors = await screen.findByRole('radiogroup', { name: 'Color' });
    expect(within(colors).getAllByRole('radio')).toHaveLength(20);
    expect(
      within(colors).getByRole('radio', { name: 'Color 3' }).getAttribute('aria-checked'),
    ).toBe('true');
    await waitFor(() =>
      expect(within(colors).getByRole('radio', { name: 'Color 1, used by HEAT' })).toBeTruthy(),
    );
    expect(within(colors).getByRole('radio', { name: 'Color 8, used by ASM' })).toBeTruthy();

    await user.click(within(colors).getByRole('radio', { name: 'Color 12' }));
    const preview = screen.getByRole('figure', { name: 'Machining on the board' });
    expect(preview.querySelector('[style*="palette-12"]')).not.toBeNull();
    expect(preview.textContent).toBe('Machining3 machinesCNC 1CNC 2Mill 1');
    await user.clear(field('Name'));
    expect(screen.getByRole('figure', { name: 'Machining on the board' })).toBeTruthy();
    await user.type(field('Name'), 'Machining hall');
    expect(screen.getByRole('figure', { name: 'Machining hall on the board' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe(machPage);

    await user.click(screen.getByRole('button', { name: 'Save equipment group' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(machPage));
    expect(sent).toEqual([
      {
        id: mach.id,
        expectedVersion: 1,
        code: 'MACH',
        name: 'Machining hall',
        color: 'palette-12',
      },
    ]);
    await waitFor(() => expect(spoken()).toBe('Equipment group MACH saved'));
  });

  it('#983 EG5 a save refused for a newer version keeps the entries and offers Reload', async () => {
    const user = userEvent.setup();
    renderCoreAt(editMach, [
      groupQuery(mach),
      groupsQuery([mach]),
      companiesQuery(),
      admin(),
      {
        request: {
          query: CoreUpdateEquipmentGroup,
          variables: {
            input: {
              id: mach.id,
              expectedVersion: 1,
              code: 'MACH',
              name: 'Machining hall',
              color: 'palette-3',
            },
          },
        },
        result: {
          errors: [
            new GraphQLError('Conflict', {
              extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
            }),
          ],
        },
      },
    ]);
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Machining hall');
    await user.click(screen.getByRole('button', { name: 'Save equipment group' }));

    expect(await screen.findByRole('button', { name: /Reload/ })).toBeTruthy();
    expect(field('Name').value).toBe('Machining hall');
  });

  it('#983 EG5 says a change to a company group reaches every plant of the company', async () => {
    const editHeat = coreLinks.settings.equipmentGroups.group.edit({
      plant,
      groupId: heat.id,
    }).href;
    renderCoreAt(editHeat, [groupQuery(heat), groupsQuery([heat]), companiesQuery(), admin(true)]);
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group HEAT' });
    expect(
      await screen.findByText(
        'HEAT is a company group: a change here applies at every plant of Acme AB.',
      ),
    ).toBeTruthy();
  });

  it('#983 EG5 shows a group the user may not change read-only, without Save', async () => {
    renderCoreAt(
      editMach,
      [
        viewerQuery(['core.equipmentGroup:read']),
        groupQuery(mach),
        groupsQuery([mach]),
        companiesQuery(),
      ],
      { hold: answeredAfter('CoreViewer', 'CoreEquipmentGroup') },
    );
    await screen.findByRole('heading', { level: 1, name: 'Edit equipment group MACH' });
    expect(field('Name').hasAttribute('readonly')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save equipment group' })).toBeNull();
  });

  it('#983 EG5 shows the loading, not-found and failed states of the form', async () => {
    const held = holdRequests((operation) => operation.operationName === 'CoreEquipmentGroup');
    renderCoreAt(editMach, [groupQuery(mach, null), groupsQuery([]), companiesQuery(), admin()], {
      hold: held.link,
    });
    expect(await screen.findByText('Loading the equipment group.')).toBeTruthy();
    held.release();
    await screen.findByRole('heading', {
      level: 2,
      name: 'This equipment group does not exist or you cannot see it',
    });

    cleanup();
    renderCoreAt(editMach, [
      {
        request: { query: CoreEquipmentGroup, variables: { id: mach.id } },
        error: new Error('Network down'),
      },
      groupsQuery([]),
      companiesQuery(),
      admin(),
    ]);
    await screen.findByRole('heading', { level: 2, name: 'Could not load the equipment group' });
  });
});

describe('a new equipment group (design #729)', () => {
  it('#983 New equipment group creates a plant group with the trimmed code and name and without a picked color, then opens its page', async () => {
    const user = userEvent.setup();
    const sent: Record<string, unknown>[] = [];
    const created = group('PAINT', 'Paint shop', { color: 'palette-2', colorFrom: 'palette' });
    const router = renderCoreAt(newGroup, [
      groupsQuery([heat]),
      companiesQuery(),
      admin(true),
      {
        request: {
          query: CoreCreateEquipmentGroup,
          variables: ({ input }: { input: Record<string, unknown> }) => {
            sent.push(input);
            return true;
          },
        },
        result: ({ input }: { input: { id: string } }) => ({
          data: { coreCreateEquipmentGroup: { ...created, id: input.id } },
        }),
      } as MockLink.MockedResponse,
      groupsQuery([created, heat]),
    ]);

    await screen.findByRole('heading', { level: 1, name: 'New equipment group' });
    const scope = await screen.findByRole('radiogroup', { name: 'Scope' });
    expect(
      (await within(scope).findByRole('radio', { name: 'Plant A' })).getAttribute('aria-checked'),
    ).toBe('true');
    expect(within(scope).getByRole('radio', { name: /^Acme AB/ })).toBeTruthy();
    const colors = screen.getByRole('radiogroup', { name: 'Color' });
    expect(within(colors).queryByRole('radio', { checked: true })).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByText(
          'One of the 20 palette colors. Pick none and the group takes Color 2, the first palette color that no group uses.',
        ),
      ).toBeTruthy(),
    );

    await user.type(field('Code'), ' PAINT ');
    await user.type(field('Name'), 'Paint shop ');
    const preview = screen.getByRole('figure', { name: 'Paint shop on the board' });
    expect(preview.querySelector('[style*="palette-2"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save equipment group' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/equipment-groups\/[0-9a-f-]{36}$/),
    );
    expect(sent).toEqual([
      { id: expect.any(String), scope: 'plant', code: 'PAINT', name: 'Paint shop' },
    ]);
    expect(router.state.location.pathname).toBe(
      coreLinks.settings.equipmentGroups.group({ plant, groupId: String(sent[0]?.id) }).href,
    );
    await waitFor(() => expect(spoken()).toBe('Equipment group PAINT created'));
  });

  it('#983 New equipment group puts a taken code on Code and keeps the entries', async () => {
    const user = userEvent.setup();
    renderCoreAt(newGroup, [
      groupsQuery([heat]),
      companiesQuery(),
      admin(true),
      {
        request: {
          query: CoreCreateEquipmentGroup,
          variables: () => true,
        },
        result: {
          errors: [
            new GraphQLError('Code taken', {
              extensions: {
                code: 'BAD_REQUEST',
                errorCode: 'core.code_taken',
                fieldErrors: [{ path: ['code'], code: 'core.code_taken', message: 'taken' }],
              },
            }),
          ],
        },
      } as MockLink.MockedResponse,
    ]);
    await user.type(await screen.findByRole('textbox', { name: 'Code' }), 'HEAT');
    await user.type(field('Name'), 'Heat');
    await user.click(
      within(await screen.findByRole('radiogroup', { name: 'Color' })).getByRole('radio', {
        name: 'Color 5',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save equipment group' }));

    expect(
      (await screen.findAllByText('Code HEAT is already in use here. Choose another code.')).length,
    ).toBeGreaterThan(0);
    expect(field('Code').value).toBe('HEAT');
  });

  it('#983 New equipment group offers only the scopes where the user may create, and says so where there is none', async () => {
    renderCoreAt(
      newGroup,
      [
        viewerQuery(['core.equipmentGroup:read', 'core.equipmentGroup:create']),
        groupsQuery([]),
        companiesQuery(),
      ],
      { hold: answeredAfter('CoreViewer', 'CoreEquipmentGroups') },
    );
    const scope = await screen.findByRole('radiogroup', { name: 'Scope' });
    expect(
      within(scope)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-checked')),
    ).toEqual(['true']);

    cleanup();
    renderCoreAt(
      newGroup,
      [viewerQuery(['core.equipmentGroup:read']), groupsQuery([]), companiesQuery()],
      { hold: answeredAfter('CoreViewer', 'CoreEquipmentGroups') },
    );
    await screen.findByRole('heading', {
      level: 2,
      name: 'You need the permission to create equipment groups in Plant A',
    });
    expect(screen.queryByRole('button', { name: 'Save equipment group' })).toBeNull();
  });
});
