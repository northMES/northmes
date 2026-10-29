// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { companySettingsHref } from '@northmes/web-sdk';
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
  forbidden,
  isBefore,
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

/** A Company admin of Acme AB, who reads users and roles there; the screens' own reads stay open. */
function companyAdmin(companyPermissions = ['core.role:read', 'core.user:read']) {
  return fakeApi({
    CoreCompanies: companies,
    CoreViewer: ({ companyId: asked }) =>
      asked === companyId
        ? viewer([], companyPermissions)
        : viewer(['core.article:read'], companyPermissions),
  });
}

describe('company settings', () => {
  it('E04-S02 a deep link to /settings/<company id>/users renders Users in company settings, without the main sidebar and without a plant', async () => {
    const { fetch, seen } = companyAdmin();
    renderShellAt(`/settings/${companyId}/users`, shellModules, { fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    const settings = await screen.findByRole('navigation', { name: 'Company settings' });
    expect(screen.getByRole('main').contains(settings)).toBe(true);
    await waitFor(() =>
      expect(linksIn(settings)).toEqual([
        ['Users', `/settings/${companyId}/users`],
        ['Roles', `/settings/${companyId}/roles`],
      ]),
    );
    expect(within(settings).getByRole('link', { name: 'Users' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(screen.queryByRole('button', { name: /sidebar$/ })).toBeNull();
    await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(3));
    expect(seen.every(({ plant }) => plant === null)).toBe(true);
    expect(
      seen.find(({ operationName }) => operationName === 'CoreUsers')?.variables,
    ).toMatchObject({ companyId });
  });

  it("#766 a user's page under Users marks Users as the entry it lies under, and Roles not at all", async () => {
    const { fetch } = companyAdmin();
    renderShellAt(`/settings/${companyId}/users/u-1`, shellModules, { fetch });

    const settings = await screen.findByRole('navigation', { name: 'Company settings' });
    await waitFor(() =>
      expect(
        within(settings).getByRole('link', { name: 'Users' }).getAttribute('aria-current'),
      ).toBe('true'),
    );
    expect(
      within(settings).getByRole('link', { name: 'Roles' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('E04-S02 company settings pages put the company name where the plant goes: in the title and in the trail after Settings', async () => {
    const { fetch } = companyAdmin();
    renderShellAt(`/settings/${companyId}/roles`, shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Roles' });

    await waitFor(() => expect(document.title).toBe('Roles · Acme AB · NorthMES'));
    expect(crumbs()).toEqual(['Settings', 'Acme AB', 'Roles']);
    const breadcrumb = within(screen.getByRole('banner')).getByRole('navigation', {
      name: 'Breadcrumb',
    });
    expect(within(breadcrumb).getByRole('link', { name: 'Acme AB' }).getAttribute('href')).toBe(
      `/settings/${companyId}`,
    );
  });

  it('E04-S02 every company settings route has a title with the company name in place of the plant', async () => {
    const userId = '019a0000-0000-7000-8000-00000000b001';
    const roleId = '019a0000-0000-7000-8000-00000000c001';
    for (const path of [
      '',
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
      renderShellAt(`/settings/${companyId}${path}`, shellModules, { fetch });
      await screen.findByRole('heading', { level: 1 });

      await waitFor(() => expect(document.title, path).toMatch(/ · Acme AB · NorthMES$/));
      cleanup();
    }
  });

  it('E04-S02 the company landing goes on to the first company settings page the user may open, with no page of its own (#876)', async () => {
    const { fetch } = companyAdmin(['core.user:read']);
    const router = renderShellAt(`/settings/${companyId}`, shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: 'Users' });
    expect(router.state.location.pathname).toBe(`/settings/${companyId}/users`);
    await waitFor(() => expect(document.title).toBe('Users · Acme AB · NorthMES'));
    expect(crumbs()).toEqual(['Settings', 'Acme AB', 'Users']);
  });

  it('E04-S02 the company settings navigation puts the entries of every module other than core under one Modules group, in module order', async () => {
    const { fetch } = companyAdmin(['core.user:read']);
    const modules = [
      ...shellModules,
      settingsModule('quality', 'Quality', 30),
      settingsModule('maintenance', 'Maintenance', 40),
    ];
    renderShellAt(`/settings/${companyId}/users`, modules, { fetch });

    const settings = await screen.findByRole('navigation', { name: 'Company settings' });
    const group = await within(settings).findByRole('list', { name: 'Modules' });
    expect(linksIn(group)).toEqual([
      ['Quality rules', `/settings/${companyId}/quality/rules`],
      ['Maintenance rules', `/settings/${companyId}/maintenance/rules`],
    ]);
  });

  it('E04-S02 Back to the plant leads to the plant the user came from, through the Settings button', async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin();
    renderShellAt('/plant-b/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });

    await user.click(
      await within(screen.getByRole('banner')).findByRole('link', { name: 'Settings' }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Users' });
    const back = await screen.findByRole('link', { name: 'Back to Plant B' });
    expect(back.getAttribute('href')).toBe('/plant-b');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('E04-S02 the skip link lands after the company settings navigation', async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin(['core.user:read']);
    renderShellAt(`/settings/${companyId}/users`, shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Users' });
    await screen.findByRole('navigation', { name: 'Company settings' });

    await user.tab();
    expect(focusedName()).toBe('Skip to main content');
    await user.keyboard('{Enter}');

    const content = document.getElementById('settings-content');
    expect(content?.contains(document.activeElement)).toBe(true);
    expect(
      screen.getByRole('navigation', { name: 'Company settings' }).contains(document.activeElement),
    ).toBe(false);
  });

  it("E04-S02 leaving company settings returns the main sidebar to the user's own state", async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin();
    renderShellAt('/plant-b/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    await user.click(
      await within(screen.getByRole('banner')).findByRole('link', { name: 'Settings' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Users' });
    await user.click(await screen.findByRole('link', { name: 'Back to Plant B' }));

    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();
  });

  it('E04-S02 the landing of a company the user holds no role in says so, without the loading state, and leads back to the plant', async () => {
    const foreign = '019a0000-0000-7000-8000-0000000f0e10';
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: ({ companyId: asked }) =>
        asked === undefined ? viewer(['core.article:read'], ['core.user:read']) : forbidden(),
    });
    const router = renderShellAt('/plant-a/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });

    await router.navigate({ href: companySettingsHref(foreign) });

    await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    const main = screen.getByRole('main');
    expect(
      await within(main).findByText(
        'These company settings do not exist, or you cannot open them. The link may be out of date.',
      ),
    ).toBeDefined();
    expect(main.querySelector('[aria-busy="true"]')).toBeNull();
    const back = within(main).getAllByRole('link', { name: 'Back to Plant A' });
    expect(back.map((link) => link.getAttribute('href'))).toEqual(['/plant-a', '/plant-a']);
  });

  it('E04-S02 a company landing whose permissions could not be read shows the error with Try again, which reads them again', async () => {
    const user = userEvent.setup();
    let reads = 0;
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: () => {
        reads += 1;
        return reads === 1 ? unreachable : viewer([], ['core.user:read']);
      },
    });
    renderShellAt(`/settings/${companyId}`, shellModules, { fetch });

    await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'Could not load company settings' }),
    ).toBeDefined();
    expect(within(alert).getByText('Check the connection, then try again.')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await screen.findByRole('heading', { level: 1, name: 'Users' });
  });
});

describe('company settings below 768 px', () => {
  it('E04-S02 at 320 px a company settings page reached from a plant shows Back to the plant above its h1 and no settings navigation (C5, #876)', async () => {
    setViewport(320, 640);
    const user = userEvent.setup();
    const { fetch } = companyAdmin();
    renderShellAt('/plant-b/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });
    await user.click(
      await within(screen.getByRole('banner')).findByRole('link', { name: 'Settings' }),
    );

    const heading = await screen.findByRole('heading', { level: 1, name: 'Users' });
    const back = await within(screen.getByRole('main')).findByRole('link', {
      name: 'Back to Plant B',
    });
    expect(back.getAttribute('href')).toBe('/plant-b');
    expect(isBefore(back, heading)).toBe(true);
    expect(screen.queryByRole('navigation', { name: 'Company settings' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Company settings' })).toBeNull();
  });

  it('E04-S02 at 320 px a company settings page opened by its address shows Back to your plants above its h1 (#876)', async () => {
    setViewport(320, 640);
    const { fetch } = companyAdmin();
    renderShellAt(`/settings/${companyId}/users`, shellModules, { fetch });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Users' });
    const back = await within(screen.getByRole('main')).findByRole('link', {
      name: 'Back to your plants',
    });
    expect(back.getAttribute('href')).toBe('/');
    expect(isBefore(back, heading)).toBe(true);
    expect(screen.queryByRole('navigation', { name: 'Company settings' })).toBeNull();
  });
});
