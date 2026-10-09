// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreRole } from '../../../src/modules/core/role.graphql.ts';
import { CoreUpdateRole } from '../../../src/modules/core/screens/edit-role/update-role.graphql.ts';
import { CoreCreateRole } from '../../../src/modules/core/screens/new-role/create-role.graphql.ts';
import {
  acme,
  catalogQuery,
  companiesQuery,
  companyId,
  groupedRows,
  planner,
  plantA,
  role,
  roleQuery,
  rolesQuery,
  sara,
  settingsViewerQuery,
  shiftLead,
  viewerRole,
} from './access-fixtures.ts';
import { renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Jonas Holm manages roles and holds the planning permissions but Run autoplan at Acme AB. */
const jonas = [
  'core.role:read',
  'core.role:manage',
  'planning.productionOrder:read',
  'planning.productionOrder:release',
];

/** Karin Dahl manages roles and holds every permission of the catalog. */
const karin = [...jonas, 'core.user:read', 'planning.autoplan:run'];

function checkbox(name: string): HTMLElement {
  return screen.getByRole('checkbox', { name });
}

describe('the role editor', () => {
  it('E05-S06 New role from Planner copies its permissions once and shows the difference, with no lock, since a new role is assigned nowhere; Create role opens the new role and announces it', async () => {
    const user = userEvent.setup();
    const created = role('Night planner', ['planning.productionOrder:read']);
    const router = renderCoreAt(
      coreLinks.settings.roles.new({ companyId }, { from: planner.id }).href,
      [
        settingsViewerQuery(jonas),
        companiesQuery(),
        rolesQuery([shiftLead, planner, viewerRole]),
        catalogQuery(),
        {
          request: {
            query: CoreCreateRole,
            variables: ({
              input,
            }: {
              input: { id: string; name: string; permissions: string[]; reason?: string };
            }) =>
              uuidv7.test(input.id) &&
              input.name === 'Night planner' &&
              input.permissions.join() === 'planning.productionOrder:read' &&
              input.reason === 'Night shift plans its own orders',
          },
          result: { data: { coreCreateRole: created } },
        } as MockLink.MockedResponse,
      ],
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'New role' })).toBeDefined();
    const startFrom = await screen.findByRole('combobox', { name: 'Start from' });
    expect(startFrom.textContent).toContain('Planner');
    // Start from comes before Role name.
    const roleName = screen.getByRole('textbox', { name: 'Role name' });
    expect(
      startFrom.compareDocumentPosition(roleName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The new role copies its permissions once. It does not follow later changes to Planner.',
      ),
    ).toBeDefined();
    // The count is plain text; a change says the new count through the announcer.
    const count = await screen.findByText('3 of 6 selected.');
    expect(count.getAttribute('role')).toBeNull();

    // A new role is assigned nowhere, so the server asks for no permission to create it: nothing
    // is locked, also Read users and Run autoplan, which the editor does not hold.
    await user.click(screen.getByRole('button', { name: /^Core/ }));
    expect(checkbox('Read users and their roles').hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('You do not hold it at Acme AB.')).toBeNull();
    const autoplan = checkbox('Run autoplan');
    expect(autoplan.getAttribute('aria-checked')).toBe('true');
    await user.click(autoplan);
    expect(checkbox('Run autoplan').hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('2 of 6 selected.')).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('2 of 6 selected.'));
    // The module that is not installed never shows.
    expect(screen.queryByText('kanban.board:read')).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Role name' }), 'Night planner');
    const release = checkbox('Release production orders to the floor');
    release.focus();
    await user.keyboard(' ');

    expect(document.activeElement).toBe(release);
    expect(release.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('1 of 6 selected.')).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('1 of 6 selected.'));
    // The difference is a card above Permissions: a summary line, then what is added and removed,
    // each with its line and id; the rows carry the same marks, a removed line struck through.
    const difference = screen.getByRole('region', { name: 'Difference from Planner' });
    const permissions = screen.getByRole('region', { name: 'Permissions' });
    expect(
      difference.compareDocumentPosition(permissions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(difference).getByText(
        "Night planner holds 1 permission: Planner's 3, with 0 added and 2 removed.",
      ),
    ).toBeDefined();
    expect(within(difference).getByRole('heading', { name: 'Added (0)' })).toBeDefined();
    const removed = within(difference).getByRole('list', { name: 'Removed (2)' });
    expect(
      within(removed)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Release production orders to the floorplanning.productionOrder:release',
      'Run autoplanplanning.autoplan:run',
    ]);
    const autoplanRow = checkbox('Run autoplan').closest('li') as HTMLElement;
    expect(within(autoplanRow).getByText('Removed')).toBeDefined();
    expect(within(autoplanRow).getByText('Run autoplan').className).toContain('line-through');
    // Modules come in the order of the sidebar, each id beside its line.
    expect(
      within(permissions)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent?.replace(/\d+ of \d+$/, '')),
    ).toEqual(['Core', 'Planning']);
    expect(
      within(permissions).getByText(
        'Grouped by module in the order of the sidebar. Each line says what the permission allows; its id is for docs and support.',
      ),
    ).toBeDefined();

    // The side column: who holds the role, the reason and the buttons.
    const holders = screen.getByRole('region', { name: 'Who holds Night planner' });
    expect(
      within(holders).getByText(
        'Nobody yet. After you create the role, add it to people on their Access tab.',
      ),
    ).toBeDefined();
    const reason = screen.getByRole('textbox', { name: 'Reason (optional)' });
    expect(reason.getAttribute('placeholder')).toBe('Why you create this role');
    expect(reason.getAttribute('maxlength')).toBe('500');
    expect(
      screen.getByText(
        "Shown in the role's history. Do not enter personal data. Up to 500 characters.",
      ),
    ).toBeDefined();
    await user.type(reason, 'Night shift plans its own orders');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Night planner' })).toBeDefined();
    expect(router.state.location.pathname).toBe(
      coreLinks.settings.roles.role({ companyId, roleId: created.id }).href,
    );
    await waitFor(() => expect(spoken()).toBe('Night planner created.'));
  });

  it('E05-S06 Start from lists No role, then the custom roles and the default roles, each with its kind, and choosing one copies its permissions once', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.roles.new({ companyId }).href, [
      settingsViewerQuery(karin),
      companiesQuery(),
      rolesQuery([shiftLead, planner, viewerRole]),
      catalogQuery(),
    ]);

    const startFrom = await screen.findByRole('combobox', { name: 'Start from' });
    expect(startFrom.textContent).toContain('No role');
    expect(
      screen.getByText('The new role starts with no permissions. Tick the ones it needs below.'),
    ).toBeDefined();
    await user.click(startFrom);
    const listbox = await screen.findByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'No role',
      'Shift leadCustom role. 2 permissions.',
      'PlannerPlanning, default role. 3 permissions.',
      'ViewerPlanning, default role. 1 permission.',
    ]);
    await user.click(within(listbox).getByRole('option', { name: /^Planner/ }));

    await waitFor(() => expect(screen.getByText('3 of 6 selected.')).toBeDefined());
    expect(screen.getByRole('region', { name: 'Difference from Planner' })).toBeDefined();
  });

  it('E05-S06 a role created after the roles list was read shows on the list when the user returns to it', async () => {
    const user = userEvent.setup();
    const created = role('Night planner', []);
    const router = renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      settingsViewerQuery(jonas),
      companiesQuery(),
      rolesQuery([shiftLead, planner, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateRole,
          variables: ({ input }: { input: { name: string } }) => input.name === 'Night planner',
        },
        result: { data: { coreCreateRole: created } },
      } as MockLink.MockedResponse,
    ]);

    expect(await screen.findByText('3 roles at Acme AB')).toBeDefined();
    await user.click(await screen.findByRole('link', { name: 'New role' }));
    await user.type(await screen.findByRole('textbox', { name: 'Role name' }), 'Night planner');
    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Night planner' })).toBeDefined();

    await router.navigate({ to: coreLinks.settings.roles({ companyId }).href });

    expect(await screen.findByText('4 roles at Acme AB')).toBeDefined();
    expect(
      groupedRows(screen.getByRole('table', { name: 'Roles' }))[0]?.[1].map(([name]) => name),
    ).toEqual(['Night planner', 'Shift lead']);
  });

  it('E05-S06 Edit role lets the editor untick a permission of the role he does not hold and tick it again, since the role holds it already', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(['core.role:read', 'core.role:manage', 'planning.productionOrder:read']),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit Shift lead' })).toBeDefined();
    const release = await screen.findByRole('checkbox', {
      name: 'Release production orders to the floor',
    });
    await user.click(release);
    expect(release.getAttribute('aria-checked')).toBe('false');
    await user.click(checkbox('Release production orders to the floor'));
    expect(checkbox('Release production orders to the floor').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(checkbox('Run autoplan').hasAttribute('disabled')).toBe(true);
  });

  it('E05-S06 Edit role locks adding a permission the editor does not hold where the role is assigned, says where, and the note above the checklist says why', async () => {
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(jonas),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
    ]);

    const autoplan = await screen.findByRole('checkbox', { name: 'Run autoplan' });
    expect(autoplan.hasAttribute('disabled')).toBe(true);
    await userEvent.setup().click(screen.getByRole('button', { name: /^Core/ }));
    expect(screen.getAllByText('You do not hold it at Plant A.')).toHaveLength(2);
    expect(checkbox('Read roles').hasAttribute('disabled')).toBe(false);
    expect(
      screen.getByText(
        'You can add a permission to Shift lead only when you hold it at Plant A, where Shift lead is assigned. The others show a lock.',
      ),
    ).toBeDefined();
  });

  it('E05-S06 Edit role of a role nobody holds locks nothing, since adding a permission there needs none', async () => {
    const nightPlanner = role('Night planner', ['planning.productionOrder:read']);
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: nightPlanner.id }).href, [
      settingsViewerQuery(jonas),
      companiesQuery(),
      roleQuery(nightPlanner),
      catalogQuery(),
    ]);

    const autoplan = await screen.findByRole('checkbox', { name: 'Run autoplan' });
    expect(autoplan.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/only when you hold it/)).toBeNull();
  });

  it('E05-S06 a module with nothing ticked starts closed, and Enter on its button opens and closes it with focus kept', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.roles.new({ companyId }).href, [
      settingsViewerQuery(karin),
      companiesQuery(),
      rolesQuery([shiftLead]),
      catalogQuery(),
    ]);

    // A module with nothing ticked starts closed, with its count.
    const planning = await screen.findByRole('button', { name: /^Planning/ });
    expect(planning.getAttribute('aria-expanded')).toBe('false');
    expect(planning.textContent).toContain('0 of 3');
    expect(planning.closest('h3')).not.toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Run autoplan' })).toBeNull();
    planning.focus();
    await user.keyboard('{Enter}');

    expect(planning.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(planning);
    expect(screen.getByRole('checkbox', { name: 'Run autoplan' })).toBeDefined();
    await user.keyboard('{Enter}');
    expect(planning.getAttribute('aria-expanded')).toBe('false');
  });

  it('E05-S06 Edit role saves the ticks and the reason with the version it started from, opens the role and says whom it applies to', async () => {
    const user = userEvent.setup();
    const saved = {
      ...shiftLead,
      version: 2,
      permissions: [...shiftLead.permissions, 'planning.autoplan:run'],
    };
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(karin),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: {
            input: {
              id: shiftLead.id,
              expectedVersion: 1,
              name: 'Shift lead',
              permissions: [...shiftLead.permissions, 'planning.autoplan:run'],
              reason: 'Night shift plans too',
            },
          },
        },
        result: { data: { coreUpdateRole: saved } },
      },
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit Shift lead' })).toBeDefined();
    expect(await screen.findByText('Custom role, Acme AB')).toBeDefined();
    // The side column says where the role applies and to whom.
    const applies = screen.getByRole('region', { name: 'Where Shift lead applies' });
    expect(
      within(applies).getByText(
        'Assigned to 2 people at Plant A. A saved change applies to them from their next action.',
      ),
    ).toBeDefined();
    expect(
      within(applies)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Sara NybergPlant A', 'Anna BergPlant A']);
    expect(screen.queryByRole('region', { name: 'Changes not saved' })).toBeNull();
    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    // Changes not saved lists what differs from the saved role, and the row says Added.
    const changes = screen.getByRole('region', { name: 'Changes not saved' });
    expect(
      within(changes)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Added: Run autoplanplanning.autoplan:run']);
    const autoplanRow = screen.getByRole('checkbox', { name: 'Run autoplan' }).closest('li');
    expect(within(autoplanRow as HTMLElement).getByText('Added')).toBeDefined();
    const reason = screen.getByRole('textbox', { name: 'Reason for change (optional)' });
    expect(reason.getAttribute('placeholder')).toBe('Why you change this role');
    await user.type(
      screen.getByRole('textbox', { name: 'Reason for change (optional)' }),
      'Night shift plans too',
    );
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Shift lead' })).toBeDefined();
    await waitFor(() =>
      expect(spoken()).toBe('Shift lead saved. It applies to 2 people from their next action.'),
    );
    // The role page repeats the announcement in a note (RO41).
    expect(screen.getByRole('note').textContent).toBe(
      'Shift lead saved. It applies to 2 people from their next action.',
    );
  });

  it('E05-S06 a saved role nobody holds says only that it was saved, and one person who holds it at two places counts once', async () => {
    const user = userEvent.setup();
    const both = role('Report checker', ['planning.productionOrder:read'], {
      holders: [
        { user: sara, scope: acme },
        { user: sara, scope: plantA },
      ],
    });
    const nobody = role('Night planner', ['planning.productionOrder:read']);
    const update = (of: ReturnType<typeof role>) => ({
      request: {
        query: CoreUpdateRole,
        variables: (variables: { input: { id: string } }) => variables.input.id === of.id,
      },
      result: { data: { coreUpdateRole: { ...of, version: 2 } } },
    });
    const router = renderCoreAt(
      coreLinks.settings.roles.role.edit({ companyId, roleId: both.id }).href,
      [
        settingsViewerQuery(karin),
        companiesQuery(),
        roleQuery(both),
        catalogQuery(),
        update(both) as MockLink.MockedResponse,
        roleQuery(nobody),
        update(nobody) as MockLink.MockedResponse,
      ],
    );

    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.click(screen.getByRole('button', { name: 'Save role' }));
    await waitFor(() =>
      expect(spoken()).toBe('Report checker saved. It applies to 1 person from their next action.'),
    );

    await router.navigate({
      to: coreLinks.settings.roles.role.edit({ companyId, roleId: nobody.id }).href,
    });
    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.click(screen.getByRole('button', { name: 'Save role' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Night planner' })).toBeDefined();
    await waitFor(() => expect(spoken()).toBe('Night planner saved.'));
    expect(screen.getByRole('note').textContent).toBe('Night planner saved.');
  });

  it('E05-S06 a Save refused without core.role:manage at the company says who can make the change (RO39)', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(karin),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: (variables: Record<string, unknown>) => variables.input !== undefined,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'x',
              path: ['coreUpdateRole'],
              extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
            },
          ],
        },
      } as MockLink.MockedResponse,
    ]);

    expect(await screen.findByText('Unique within Acme AB.')).toBeDefined();
    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    const summary = await screen.findByRole('group', { name: 'Shift lead was not saved' });
    expect(within(summary).getByRole('listitem').textContent).toBe(
      'Changing a role of Acme AB needs the permission to create and edit roles (core.role:manage) at Acme AB. A company admin of Acme AB has it and can make the change.',
    );
  });

  it('E05-S06 a Save the API refuses by the grant rule keeps every tick and the reason, and the summary takes focus and names the permission and who can act', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(karin),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: {
            input: {
              id: shiftLead.id,
              expectedVersion: 1,
              name: 'Shift lead',
              permissions: [...shiftLead.permissions, 'planning.autoplan:run'],
              reason: 'Night shift',
            },
          },
        },
        result: {
          data: null,
          errors: [
            {
              message: 'You do not hold planning.autoplan:run at scope x',
              path: ['coreUpdateRole'],
              extensions: {
                code: 'FORBIDDEN',
                errorCode: 'core.role_not_held',
                details: { scopeId: plantA.id, missingPermissions: ['planning.autoplan:run'] },
              },
            },
          ],
        },
      },
    ]);

    // The refusal names the company, so the places load first.
    expect(await screen.findByText('Unique within Acme AB.')).toBeDefined();
    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Reason for change (optional)' }),
      'Night shift',
    );
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    const summary = await screen.findByRole('group', { name: 'Shift lead was not saved' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    // Each refused permission is a link that leads to its row, whose line says why.
    const link = within(summary).getByRole('link');
    expect(link.textContent).toBe(
      'Run autoplan (planning.autoplan:run). Refused: you do not hold it at Plant A, where Shift lead is assigned.',
    );
    expect(
      screen.getByText('Refused: you do not hold it at Plant A, where Shift lead is assigned.'),
    ).toBeDefined();
    link.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(checkbox('Run autoplan'));
    const autoplan = checkbox('Run autoplan');
    expect(autoplan.getAttribute('aria-checked')).toBe('true');
    expect(autoplan.getAttribute('aria-invalid')).toBe('true');
    expect(
      (screen.getByRole('textbox', { name: 'Reason for change (optional)' }) as HTMLTextAreaElement)
        .value,
    ).toBe('Night shift');
  });

  it('E05-S06 a Save refused because the role changed offers Reload role, which fills the saved role and moves focus to Role name', async () => {
    const user = userEvent.setup();
    const renamed = { ...shiftLead, name: 'Shift leader', version: 2 };
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(karin),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: (variables: Record<string, unknown>) => variables.input !== undefined,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'The role changed',
              path: ['coreUpdateRole'],
              extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
            },
          ],
        },
      } as MockLink.MockedResponse,
      {
        request: { query: CoreRole, variables: { id: shiftLead.id, companyId } },
        result: { data: { coreRole: renamed } },
      },
    ]);

    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    const summary = await screen.findByRole('group', {
      name: 'This role changed while you edited it',
    });
    await user.click(within(summary).getByRole('button', { name: 'Reload role' }));

    const name = screen.getByRole('textbox', { name: 'Role name' }) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Shift leader'));
    expect(document.activeElement).toBe(name);
    expect(checkbox('Run autoplan').getAttribute('aria-checked')).toBe('false');
  });

  it('E05-S06 the edit route without core.role:manage at Acme AB is the page No access to Edit role', async () => {
    renderCoreAt(coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href, [
      settingsViewerQuery(['core.role:read']),
      companiesQuery(),
      roleQuery(shiftLead),
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to Edit role' }),
    ).toBeDefined();
    expect(
      await screen.findByText(
        'Opening Edit role needs the permission to create and edit roles (core.role:manage) at Acme AB. Ask a company admin of Acme AB for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Role name' })).toBeNull();
  });
});
