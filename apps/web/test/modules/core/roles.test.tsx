// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreRoles } from '../../../src/modules/core/roles.graphql.ts';
import {
  catalogQuery,
  companiesQuery,
  companyAdminRole,
  companyId,
  forbiddenError,
  groupedRows,
  inCompany,
  planner,
  plantAdminRole,
  role,
  roleQuery,
  rolesQuery,
  sara,
  settingsViewerQuery,
  setViewport,
  shiftLead,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** Reads, creates and edits roles at Acme AB, in company settings. */
const managerQuery = () => settingsViewerQuery(['core.role:read', 'core.role:manage']);

/** A custom role whose one permission belongs to a module that is not installed. */
const kanbanReader = role('Kanban reader', ['kanban.board:read']);

describe('roles', () => {
  it('E05-S06 the roles list is one table with the custom roles of the company, then the default roles from modules, each group with its count, who defines each role, how many of the installed permissions it holds and how many people hold it, a footer, and New role for a user who may manage roles', async () => {
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([kanbanReader, shiftLead, planner, viewerRole]),
      catalogQuery(),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Roles' })).toBeDefined();
    const table = await screen.findByRole('table', { name: 'Roles' });
    await waitFor(() =>
      expect(groupedRows(table)).toEqual([
        [
          'Custom roles of Acme AB',
          [
            ['Kanban reader', 'Acme AB', '0 of 61 not installed', 'None', ''],
            ['Shift lead', 'Acme AB', '2 of 6', '2 people', ''],
          ],
        ],
        [
          'Default roles from modules',
          [
            ['Planner', 'Planning', '3 of 6', 'None', ''],
            ['Viewer', 'Planning', '1 of 6', '1 person', ''],
          ],
        ],
      ]),
    );
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Custom roles of Acme AB2 roles', 'Default roles from modules2 roles']);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Role', 'Defined by', 'Permissions', 'Holders', 'Actions']);
    expect(
      within(table).getByRole('columnheader', { name: 'Role' }).getAttribute('aria-sort'),
    ).toBe('ascending');
    expect(screen.getByText('2 groups, 4 roles')).toBeDefined();
    expect(await screen.findByText('4 roles at Acme AB')).toBeDefined();
    expect((await screen.findByRole('link', { name: 'New role' })).getAttribute('href')).toBe(
      coreLinks.settings.roles.new({ companyId }).href,
    );
    expect(screen.getByRole('link', { name: 'Shift lead' }).getAttribute('href')).toBe(
      coreLinks.settings.roles.role({ companyId, roleId: shiftLead.id }).href,
    );
  });

  it("E05-S06 the roles list shows core's Company admin and Plant admin like the other default roles", async () => {
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([companyAdminRole, plantAdminRole, planner, viewerRole]),
      catalogQuery(),
    ]);

    const table = await screen.findByRole('table', { name: 'Roles' });
    await waitFor(() =>
      expect(groupedRows(table)).toEqual([
        [
          'Custom roles of Acme AB',
          [
            [
              'No custom roles yetAcme AB uses the default roles of its modules. Create a role when a job needs another set of permissions, starting from a default role or from none.',
            ],
          ],
        ],
        [
          'Default roles from modules',
          [
            ['Company admin', 'Core', '6 of 6', 'None', ''],
            ['Planner', 'Planning', '3 of 6', 'None', ''],
            ['Plant admin', 'Core', '5 of 6', 'None', ''],
            ['Viewer', 'Planning', '1 of 6', '1 person', ''],
          ],
        ],
      ]),
    );
    expect(screen.getByRole('link', { name: 'Plant admin' }).getAttribute('href')).toBe(
      coreLinks.settings.roles.role({ companyId, roleId: plantAdminRole.id }).href,
    );
  });

  it('E05-S06 Search roles, Defined by and the sort on Role filter and order the groups, and live in the URL, which opens the same view again', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([kanbanReader, shiftLead, planner, viewerRole]),
      catalogQuery(),
    ]);

    const table = await screen.findByRole('table', { name: 'Roles' });
    await user.type(screen.getByRole('searchbox', { name: 'Search roles' }), 'er');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'er' }));
    await waitFor(() =>
      expect(
        groupedRows(table).map(([group, rows]) => [group, rows.map(([name]) => name)]),
      ).toEqual([
        ['Custom roles of Acme AB', ['Kanban reader']],
        ['Default roles from modules', ['Planner', 'Viewer']],
      ]),
    );

    await user.click(screen.getByRole('button', { name: 'Defined by' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Planning' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ q: 'er', definedBy: 'planning' }),
    );
    expect(groupedRows(table).map(([group]) => group)).toEqual(['Default roles from modules']);
    expect(screen.getByText('1 group, 2 roles')).toBeDefined();

    const sort = within(table).getByRole('button', { name: 'Role' });
    await user.click(sort);
    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        q: 'er',
        definedBy: 'planning',
        sort: '-name',
      }),
    );
    expect(
      within(table).getByRole('columnheader', { name: 'Role' }).getAttribute('aria-sort'),
    ).toBe('descending');
    expect(groupedRows(table)[0]?.[1].map(([name]) => name)).toEqual(['Viewer', 'Planner']);
    expect(document.activeElement).toBe(sort);

    cleanup();
    renderCoreAt(
      `${coreLinks.settings.roles({ companyId }).href}?q=lead&definedBy=custom&sort=-name`,
      [
        managerQuery(),
        companiesQuery(),
        rolesQuery([kanbanReader, shiftLead, planner, viewerRole]),
        catalogQuery(),
      ],
    );
    const again = await screen.findByRole('table', { name: 'Roles' });
    await waitFor(() =>
      expect(
        groupedRows(again).map(([group, rows]) => [group, rows.map(([name]) => name)]),
      ).toEqual([['Custom roles of Acme AB', ['Shift lead']]]),
    );
    expect(
      (screen.getByRole('searchbox', { name: 'Search roles' }) as HTMLInputElement).value,
    ).toBe('lead');
  });

  it('E05-S06 the row menu of a custom role offers Edit role and New role from it: Enter opens it with focus on the first item, the arrows move, and Escape returns focus to its button (RO35)', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([shiftLead, planner]),
      catalogQuery(),
    ]);

    const actions = await screen.findByRole('button', { name: 'Actions for Shift lead' });
    expect(actions.getAttribute('aria-haspopup')).toBe('menu');
    actions.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(actions.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Edit role', 'New role from Shift lead']);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(menu).getByRole('menuitem', { name: 'Edit role' }),
      ),
    );
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      within(menu).getByRole('menuitem', { name: 'New role from Shift lead' }),
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(actions);
  });

  it('E05-S06 the row menu of a default role offers New role from it, which opens New role starting from it; Company admin and a reader without core.role:manage get no menu (RO37)', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([companyAdminRole, planner]),
      catalogQuery(),
      rolesQuery([companyAdminRole, planner]),
      catalogQuery(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Actions for Planner' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['New role from Planner']);
    expect(screen.queryByRole('button', { name: 'Actions for Company admin' })).toBeNull();
    await user.click(within(menu).getByRole('menuitem', { name: 'New role from Planner' }));
    await waitFor(() =>
      expect(router.state.location.href).toBe(
        coreLinks.settings.roles.new({ companyId }, { from: planner.id }).href,
      ),
    );

    cleanup();
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      settingsViewerQuery(['core.role:read']),
      companiesQuery(),
      rolesQuery([shiftLead, planner]),
      catalogQuery(),
    ]);
    expect(await screen.findByRole('link', { name: 'Shift lead' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
  });

  it('E05-S06 a search that matches no role says so and Clear filters shows every role again', async () => {
    const user = userEvent.setup();
    renderCoreAt(`${coreLinks.settings.roles({ companyId }).href}?q=zz`, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([shiftLead, planner]),
      catalogQuery(),
    ]);

    expect(await screen.findByText('No roles match these filters')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    const table = await screen.findByRole('table', { name: 'Roles' });
    expect(groupedRows(table).map(([group]) => group)).toEqual([
      'Custom roles of Acme AB',
      'Default roles from modules',
    ]);
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search roles' }));
  });

  it('E05-S06 at 320 px Filters opens a sheet with Defined by, and the table scrolls sideways in its own region (NO11)', async () => {
    const user = userEvent.setup();
    setViewport(320, 640);
    try {
      const router = renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
        managerQuery(),
        companiesQuery(),
        rolesQuery([shiftLead, planner, viewerRole]),
        catalogQuery(),
      ]);

      const region = await screen.findByRole('region', { name: 'Roles table, scrolls sideways' });
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(within(region).getByRole('table', { name: 'Roles' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Defined by' })).toBeNull();
      expect(await screen.findByText('3 roles at Acme AB')).toBeDefined();
      await user.click(screen.getByRole('button', { name: 'Filters' }));
      const sheet = await screen.findByRole('dialog', { name: 'Filters' });
      await user.click(within(sheet).getByRole('radio', { name: 'Acme AB' }));
      await waitFor(() => expect(router.state.location.search).toEqual({ definedBy: 'custom' }));
    } finally {
      setViewport(1440, 900);
    }
  });

  it('E05-S06 a reader without core.role:manage at Acme AB gets no New role, and a line says what it needs', async () => {
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      settingsViewerQuery(['core.role:read']),
      companiesQuery(),
      rolesQuery([shiftLead]),
    ]);

    expect(
      await screen.findByText(
        'Creating or changing a role needs the permission to create and edit roles (core.role:manage) at Acme AB. A company admin of Acme AB has it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'New role' })).toBeNull();
  });

  it('E05-S06 a reader without core.role:read gets the page No access to Roles: the h1, the permission it needs at the company, no data and a way out to company settings', async () => {
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      settingsViewerQuery(['core.user:read']),
      companiesQuery(),
      {
        request: { query: CoreRoles, variables: inCompany },
        result: { data: null, errors: [forbiddenError(['coreRoles'])] },
      },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to Roles' }),
    ).toBeDefined();
    expect(document.title).toBe('No access to Roles · NorthMES');
    expect(
      await screen.findByText(
        'Opening Roles needs the permission to read roles (core.role:read) at Acme AB. Ask a company admin of Acme AB for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    // A page opened by URL may have no page before it, so the way out is a link, not a step back.
    expect(screen.getByRole('link', { name: 'Go to Company settings' }).getAttribute('href')).toBe(
      `/settings/${companyId}`,
    );
  });

  it("E05-S06 a role's page lists its permissions by module, and Holders, read only, who holds it at the company and at each plant; the open tab lives in the URL", async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(
      coreLinks.settings.roles.role({ companyId, roleId: shiftLead.id }).href,
      [managerQuery(), companiesQuery(), roleQuery(shiftLead)],
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Shift lead' })).toBeDefined();
    expect(await screen.findByText('Custom role, Acme AB')).toBeDefined();
    const permissions = screen.getByRole('tabpanel', { name: 'Permissions' });
    expect(within(permissions).getByRole('heading', { level: 3, name: 'Planning' })).toBeDefined();
    expect(within(permissions).getByText('Release production orders to the floor')).toBeDefined();
    expect((await screen.findByRole('link', { name: 'Edit role' })).getAttribute('href')).toBe(
      coreLinks.settings.roles.role.edit({ companyId, roleId: shiftLead.id }).href,
    );

    const tab = screen.getByRole('tab', { name: 'Permissions' });
    tab.focus();
    await user.keyboard('{ArrowRight}');
    expect(router.state.location.search).toEqual({});
    await user.keyboard('{Enter}');

    const holders = await screen.findByRole('tabpanel', { name: 'Holders' });
    expect(router.state.location.search).toEqual({ tab: 'holders' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Holders' }));
    const atCompany = await within(holders).findByRole('region', {
      name: 'At Acme AB, all plants',
    });
    expect(
      within(atCompany).getByText(
        'A role assigned here applies to every plant of Acme AB, also plants created later.',
      ),
    ).toBeDefined();
    expect(within(atCompany).getByText('Nobody holds Shift lead at Acme AB.')).toBeDefined();
    expect(within(atCompany).queryByRole('table')).toBeNull();
    const atPlant = within(holders).getByRole('region', { name: 'At Plant A' });
    expect(within(atPlant).getByText('2 people hold Shift lead at Plant A.')).toBeDefined();
    const table = within(atPlant).getByRole('table', { name: 'Holders of Shift lead at Plant A' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Person', 'Username']);
    expect(bodyRows(table)).toEqual([
      ['Sara Nyberg', 's.nyberg'],
      ['Anna Berg', 'a.berg'],
    ]);
    expect(within(table).getByRole('link', { name: 'Sara Nyberg' }).getAttribute('href')).toBe(
      coreLinks.settings.users.user({ companyId, userId: sara.id }, { tab: 'access' }).href,
    );
    expect(within(holders).queryByRole('button')).toBeNull();
    expect(
      within(holders).getByText(
        "People in each plant's settings lists who holds a role at that plant. To add or remove a role, open the person and use the Access tab.",
      ),
    ).toBeDefined();
  });

  it('E05-S06 a default role cannot be edited: its page offers New role from it and says why', async () => {
    renderCoreAt(coreLinks.settings.roles.role({ companyId, roleId: planner.id }).href, [
      managerQuery(),
      companiesQuery(),
      roleQuery(planner),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Planner' })).toBeDefined();
    expect(screen.getByText('Planning, default role')).toBeDefined();
    expect(
      (await screen.findByRole('link', { name: 'New role from Planner' })).getAttribute('href'),
    ).toBe(coreLinks.settings.roles.new({ companyId }, { from: planner.id }).href);
    // New role from Planner shows once the reader's permissions arrived, so Edit role would too.
    expect(screen.queryByRole('link', { name: 'Edit role' })).toBeNull();
    expect(
      screen.getByText(
        'Default roles come from their module and cannot be changed here. To change one, create a role from it.',
      ),
    ).toBeDefined();
  });

  it('E05-S06 nobody holds a role: each place keeps its card with one empty line and no table (RO25)', async () => {
    renderCoreAt(
      coreLinks.settings.roles.role({ companyId, roleId: planner.id }, { tab: 'holders' }).href,
      [managerQuery(), companiesQuery(), roleQuery(planner)],
    );

    const holders = await screen.findByRole('tabpanel', { name: 'Holders' });
    const atCompany = await within(holders).findByRole('region', {
      name: 'At Acme AB, all plants',
    });
    const atPlant = within(holders).getByRole('region', { name: 'At Plant A' });
    expect(within(atCompany).getByText('Nobody holds Planner at Acme AB.')).toBeDefined();
    expect(within(atPlant).getByText('Nobody holds Planner at Plant A.')).toBeDefined();
    expect(
      within(atPlant).getByText('A role assigned here applies at Plant A only.'),
    ).toBeDefined();
    expect(within(holders).queryByRole('table')).toBeNull();
  });

  it('E05-S06 Company admin offers no New role from it while question 34 is open, and says why it cannot be changed', async () => {
    renderCoreAt(coreLinks.settings.roles.role({ companyId, roleId: companyAdminRole.id }).href, [
      managerQuery(),
      companiesQuery(),
      roleQuery(companyAdminRole),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Company admin' })).toBeDefined();
    expect(screen.getByText('Core, default role')).toBeDefined();
    expect(
      await screen.findByText(
        'Company admin always holds every installed permission. The permission sync adds the permissions of modules installed later, so this role cannot be changed here.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: /New role from/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit role' })).toBeNull();
  });

  it('E05-S06 Start from on New role does not offer Company admin while question 34 is open', async () => {
    renderCoreAt(coreLinks.settings.roles.new({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([shiftLead, companyAdminRole, planner]),
      catalogQuery(),
    ]);

    const startFrom = await screen.findByRole('combobox', { name: 'Start from' });
    expect(
      within(startFrom)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No role', 'Shift lead', 'Planner']);
  });
});
