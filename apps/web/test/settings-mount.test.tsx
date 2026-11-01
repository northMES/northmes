// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { shellModules } from '../src/modules.ts';
import {
  companies,
  companyId,
  crumbs,
  fakeApi,
  focusedName,
  linksIn,
  renderShellAt,
  settingsModule,
  setViewport,
  unreachable,
  viewer,
} from './settings-fixtures.tsx';

afterEach(() => {
  cleanup();
  setViewport(1440, 900);
  localStorage.clear();
});

/**
 * A Company admin of Acme AB, who reads users and roles there and holds plantPermissions at Plant
 * A; the screens' own reads stay open.
 */
function companyAdmin(
  companyPermissions = ['core.role:read', 'core.user:read'],
  plantPermissions = ['core.article:read'],
) {
  return fakeApi({
    CoreCompanies: companies,
    CoreViewer: ({ companyId: asked }) =>
      asked === companyId
        ? viewer([], companyPermissions)
        : viewer(plantPermissions, companyPermissions),
  });
}

describe("the company's settings pages under a plant", () => {
  it('#876 a deep link to /plant-a/settings/users renders Users in the plant layout, with the plant settings navigation and the main sidebar on the rail, and its reads name the company and no plant', async () => {
    const { fetch, seen } = companyAdmin();
    renderShellAt('/plant-a/settings/users', shellModules, { fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });
    expect(screen.getByRole('main').contains(settings)).toBe(true);
    const company = await within(settings).findByRole('list', { name: 'Acme AB settings' });
    expect(linksIn(company)).toEqual([
      ['Users', '/plant-a/settings/users'],
      ['Roles', '/plant-a/settings/roles'],
    ]);
    expect(within(settings).getByRole('link', { name: 'Users' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();
    await waitFor(() =>
      expect(seen.some(({ operationName }) => operationName === 'CoreUsers')).toBe(true),
    );
    const users = seen.find(({ operationName }) => operationName === 'CoreUsers');
    expect(users?.plant).toBeNull();
    expect(users?.variables).toMatchObject({ companyId });
  });

  it("ADR0092 a Plant admin, who reads users at the plant only, finds Users in the company's group and no People, and Users reads at the plant with x-northmes-plant and no company", async () => {
    const { fetch, seen } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: () => viewer(['core.user:read', 'core.roleAssignment:manage'], []),
    });
    renderShellAt('/plant-a/settings/users', shellModules, { fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });
    const company = await within(settings).findByRole('list', { name: 'Acme AB settings' });
    expect(linksIn(company)).toEqual([['Users', '/plant-a/settings/users']]);
    expect(within(settings).queryByRole('link', { name: 'People' })).toBeNull();
    await waitFor(() =>
      expect(seen.some(({ operationName }) => operationName === 'CoreUsers')).toBe(true),
    );
    const users = seen.find(({ operationName }) => operationName === 'CoreUsers');
    expect(users?.plant).toBe('plant-a');
    expect(users?.variables).not.toHaveProperty('companyId');
  });

  it("ADR0092 /plant-a/settings/people shows the plant's page not found, since People went into Users", async () => {
    const { fetch } = companyAdmin(['core.user:read'], ['core.user:read']);
    renderShellAt('/plant-a/settings/people', shellModules, { fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeDefined();
  });

  it('ADR0092 when the permissions could not be read, Users shows the error with Try again, which reads them again', async () => {
    const user = userEvent.setup();
    let reads = 0;
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: () => {
        reads += 1;
        return reads === 1 ? unreachable : viewer(['core.user:read'], []);
      },
    });
    renderShellAt('/plant-a/settings/users', shellModules, { fetch });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Could not load settings' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
  });

  it("#876 while the user's companies load, a page of the company shows its loading state under its h1", async () => {
    const { fetch } = fakeApi({
      CoreViewer: () => viewer(['core.article:read'], ['core.user:read']),
    });
    renderShellAt('/plant-a/settings/users', shellModules, { fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    const content = document.getElementById('settings-content');
    expect(content?.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("#876 when the user's companies could not be read, a page of the company shows the error with Try again, which reads them again", async () => {
    const user = userEvent.setup();
    let reads = 0;
    const { fetch } = fakeApi({
      CoreCompanies: () => {
        reads += 1;
        return reads === 1 ? unreachable : companies();
      },
      CoreViewer: ({ companyId: asked }) =>
        asked === companyId ? viewer([], ['core.user:read']) : viewer([], ['core.user:read']),
    });
    renderShellAt('/plant-a/settings/users', shellModules, { fetch });

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Could not load settings' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
  });

  it('#876 for a user with only company pages, the Settings crumb on a page of the company leads to the settings landing', async () => {
    const { fetch } = companyAdmin(['core.role:read'], []);
    renderShellAt('/plant-a/settings/roles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Roles' });

    const breadcrumb = within(screen.getByRole('banner')).getByRole('navigation', {
      name: 'Breadcrumb',
    });
    await waitFor(() =>
      expect(within(breadcrumb).getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe(
        '/plant-a/settings',
      ),
    );
  });

  it("#766 a user's page under Users marks Users as the entry it lies under, and Roles not at all", async () => {
    const { fetch } = companyAdmin();
    renderShellAt('/plant-a/settings/users/u-1', shellModules, { fetch });

    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });
    await waitFor(() =>
      expect(
        within(settings).getByRole('link', { name: 'Users' }).getAttribute('aria-current'),
      ).toBe('true'),
    );
    expect(
      within(settings).getByRole('link', { name: 'Roles' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('#876 a page of the company keeps the plant in the title and the Settings crumb after the plant, as plant settings pages do', async () => {
    const { fetch } = companyAdmin();
    renderShellAt('/plant-a/settings/roles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Roles' });

    await waitFor(() => expect(document.title).toBe('Roles · Plant A · NorthMES'));
    expect(crumbs()).toEqual(['Plant A', 'Settings', 'Roles']);
  });

  it('#876 every route of the company under the plant has a title with the plant', async () => {
    const userId = '019a0000-0000-7000-8000-00000000b001';
    const roleId = '019a0000-0000-7000-8000-00000000c001';
    for (const path of [
      '/users',
      '/users/new',
      `/users/${userId}`,
      `/users/${userId}/roles/new`,
      '/roles',
      '/roles/new',
      `/roles/${roleId}`,
      `/roles/${roleId}/edit`,
    ]) {
      const { fetch } = companyAdmin([
        'core.role:read',
        'core.role:manage',
        'core.roleAssignment:manage',
        'core.user:create',
        'core.user:read',
      ]);
      renderShellAt(`/plant-a/settings${path}`, shellModules, { fetch });
      await screen.findByRole('heading', { level: 1 });

      await waitFor(() => expect(document.title, path).toMatch(/ · Plant A · NorthMES$/));
      cleanup();
    }
  });

  it("#876 the company's entries of every module end the plant settings navigation in the company's group, core's first", async () => {
    const { fetch } = companyAdmin(['core.user:read']);
    const modules = [
      ...shellModules,
      settingsModule('quality', 'Quality', 30),
      settingsModule('maintenance', 'Maintenance', 40),
    ];
    renderShellAt('/plant-a/settings/users', modules, { fetch });

    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });
    const company = await within(settings).findByRole('list', { name: 'Acme AB settings' });
    expect(linksIn(company)).toEqual([
      ['Users', '/plant-a/settings/users'],
      ['Quality rules', '/plant-a/settings/quality/rules'],
      ['Maintenance rules', '/plant-a/settings/maintenance/rules'],
    ]);
  });

  it('#876 the skip link on a page of the company lands after the plant settings navigation', async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin(['core.user:read']);
    renderShellAt('/plant-a/settings/users', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Users' });
    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });

    await user.tab();
    expect(focusedName()).toBe('Skip to main content');
    await user.keyboard('{Enter}');

    const content = document.getElementById('settings-content');
    expect(content?.contains(document.activeElement)).toBe(true);
    expect(settings.contains(document.activeElement)).toBe(false);
  });
});

describe('the settings landing', () => {
  it('#876 /plant-a/settings goes on to the first settings page the user may open, with no page of its own', async () => {
    const { fetch } = companyAdmin(['core.user:read']);
    const router = renderShellAt('/plant-a/settings', shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: 'Users' });
    expect(router.state.location.pathname).toBe('/plant-a/settings/users');
    await waitFor(() => expect(document.title).toBe('Users · Plant A · NorthMES'));
  });

  it('#876 when the permissions could not be read, the landing shows the error with Try again, which reads them again and goes on', async () => {
    const user = userEvent.setup();
    let reads = 0;
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: () => {
        reads += 1;
        return reads === 1 ? unreachable : viewer([], ['core.user:read']);
      },
    });
    renderShellAt('/plant-a/settings', shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Could not load settings' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByRole('heading', { level: 1, name: 'Users' });
  });

  it('#876 for a user who may open no settings page, the landing says so', async () => {
    const { fetch } = companyAdmin([]);
    renderShellAt('/plant-a/settings', shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect(
      await screen.findByText(
        'You hold no permission that opens a settings page here. Ask a plant admin for a role that includes one.',
      ),
    ).toBeDefined();
    expect(crumbs()).toEqual(['Plant A', 'Settings']);
    expect(document.title).toBe('Settings · Plant A · NorthMES');
  });

  it("#876 while the user's companies load, the landing shows its loading state, not that the user may open nothing", async () => {
    const { fetch } = fakeApi({ CoreViewer: () => viewer([], ['core.role:read']) });
    renderShellAt('/plant-a/settings', shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const content = document.getElementById('settings-content');
    await waitFor(() => expect(content?.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(screen.queryByText(/You hold no permission/)).toBeNull();
  });
});

describe('URLs from before a page moved', () => {
  it.each([
    `/settings/${companyId}/users`,
    `/settings/${companyId}`,
    '/plant-a/people',
    '/plant-a/machines?group=MACH',
    '/plant-a/core/articles',
    '/plant-a/planning/settings/board-fields',
  ])('#950 %s leads nowhere: it stays and shows a not found page', async (old) => {
    const { fetch } = companyAdmin();
    const router = renderShellAt(old, shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: /not found$/ });
    expect(router.state.location.href).toBe(old);
  });
});
