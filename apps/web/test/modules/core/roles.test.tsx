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
  inCompany,
  planner,
  plantAdminRole,
  role,
  roleQuery,
  rolesQuery,
  sara,
  settingsViewerQuery,
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
  it('E05-S06 the roles list shows the custom roles, then the default roles, with who defines them, how many of the installed permissions they hold and how many people hold them here, and New role for a user who may manage roles', async () => {
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([kanbanReader, shiftLead, planner, viewerRole]),
      catalogQuery(),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Roles' })).toBeDefined();
    const custom = await screen.findByRole('table', { name: 'Custom roles of Acme AB' });
    await waitFor(() =>
      expect(bodyRows(custom)).toEqual([
        ['Kanban reader', 'Acme AB', '0 of 61 not installed', 'None'],
        ['Shift lead', 'Acme AB', '2 of 6', '2 people'],
      ]),
    );
    await waitFor(() =>
      expect(
        within(custom)
          .getAllByRole('columnheader')
          .map((header) => header.textContent),
      ).toEqual(['Role', 'Defined by', 'Permissions', 'Holders']),
    );
    expect(bodyRows(screen.getByRole('table', { name: 'Default roles from modules' }))).toEqual([
      ['Planner', 'Planning', '3 of 6', 'None'],
      ['Viewer', 'Planning', '1 of 6', '1 person'],
    ]);
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

    const defaults = await screen.findByRole('table', { name: 'Default roles from modules' });
    await waitFor(() =>
      expect(bodyRows(defaults)).toEqual([
        ['Company admin', 'Core', '6 of 6', 'None'],
        ['Plant admin', 'Core', '5 of 6', 'None'],
        ['Planner', 'Planning', '3 of 6', 'None'],
        ['Viewer', 'Planning', '1 of 6', '1 person'],
      ]),
    );
    expect(screen.getByRole('link', { name: 'Plant admin' }).getAttribute('href')).toBe(
      coreLinks.settings.roles.role({ companyId, roleId: plantAdminRole.id }).href,
    );
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
