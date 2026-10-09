// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreRoles } from '../../../src/modules/core/roles.graphql.ts';
import {
  companiesQuery,
  companyAdminRole,
  companyId,
  forbiddenError,
  inCompany,
  planner,
  plantAdminRole,
  roleQuery,
  rolesQuery,
  settingsViewerQuery,
  shiftLead,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** Reads, creates and edits roles at Acme AB, in company settings. */
const managerQuery = () => settingsViewerQuery(['core.role:read', 'core.role:manage']);

describe('roles', () => {
  it('E05-S06 the roles list shows the custom roles, then the default roles, with who defines them and how many hold them here, and New role for a user who may manage roles', async () => {
    renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      managerQuery(),
      companiesQuery(),
      rolesQuery([shiftLead, planner, viewerRole]),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Roles' })).toBeDefined();
    const custom = await screen.findByRole('table', { name: 'Custom roles of Acme AB' });
    await waitFor(() => expect(bodyRows(custom)).toEqual([['Shift lead', 'Acme AB', '2', '2']]));
    await waitFor(() =>
      expect(
        within(custom)
          .getAllByRole('columnheader')
          .map((header) => header.textContent),
      ).toEqual(['Role', 'Defined by', 'Permissions', 'Holders']),
    );
    expect(bodyRows(screen.getByRole('table', { name: 'Default roles from modules' }))).toEqual([
      ['Planner', 'Planning', '3', '0'],
      ['Viewer', 'Planning', '1', '1'],
    ]);
    expect(await screen.findByText('3 roles at Acme AB')).toBeDefined();
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
    ]);

    const defaults = await screen.findByRole('table', { name: 'Default roles from modules' });
    await waitFor(() =>
      expect(bodyRows(defaults)).toEqual([
        ['Company admin', 'Core', '9', '0'],
        ['Plant admin', 'Core', '6', '0'],
        ['Planner', 'Planning', '3', '0'],
        ['Viewer', 'Planning', '1', '1'],
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
        'Creating and editing roles needs the permission to create and edit roles (core.role:manage) at Acme AB.',
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
    expect(await screen.findByText('Custom role of Acme AB')).toBeDefined();
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
    expect(await within(holders).findByText('Nobody holds Shift lead at Acme AB.')).toBeDefined();
    expect(within(holders).getByText('2 people hold Shift lead at Plant A.')).toBeDefined();
    expect(within(holders).getByRole('link', { name: 'Sara Nyberg' })).toBeDefined();
    expect(within(holders).queryByRole('button')).toBeNull();
    expect(
      within(holders).getByText('To add or remove a role, open the person and use the Access tab.'),
    ).toBeDefined();
  });

  it('E05-S06 a default role cannot be edited: its page offers New role from it and says why', async () => {
    renderCoreAt(coreLinks.settings.roles.role({ companyId, roleId: planner.id }).href, [
      managerQuery(),
      companiesQuery(),
      roleQuery(planner),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Planner' })).toBeDefined();
    expect(screen.getByText('Default role from Planning')).toBeDefined();
    expect(
      (await screen.findByRole('link', { name: 'New role from Planner' })).getAttribute('href'),
    ).toBe(coreLinks.settings.roles.new({ companyId }, { from: planner.id }).href);
    // New role from Planner shows once the reader's permissions arrived, so Edit role would too.
    expect(screen.queryByRole('link', { name: 'Edit role' })).toBeNull();
    expect(
      screen.getByText(
        'Default roles come from their module and cannot be changed. To change one, make a new role from it.',
      ),
    ).toBeDefined();
  });
});
