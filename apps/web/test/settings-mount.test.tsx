// SPDX-License-Identifier: AGPL-3.0-or-later
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
  it('E04-S02 a deep link to /settings/<company id>/core/users renders Users in company settings, without the main sidebar and without a plant', async () => {
    const { fetch, seen } = companyAdmin();
    renderShellAt(`/settings/${companyId}/core/users`, shellModules, { fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    const settings = await screen.findByRole('navigation', { name: 'Company settings' });
    expect(screen.getByRole('main').contains(settings)).toBe(true);
    await waitFor(() =>
      expect(linksIn(settings)).toEqual([
        ['Users', `/settings/${companyId}/core/users`],
        ['Roles', `/settings/${companyId}/core/roles`],
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

  it('E04-S02 company settings pages put the company name where the plant goes: in the title and in the trail after Settings', async () => {
    const { fetch } = companyAdmin();
    renderShellAt(`/settings/${companyId}/core/roles`, shellModules, { fetch });
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
      '/core/users',
      '/core/users/new',
      `/core/users/${userId}`,
      `/core/users/${userId}/roles/new`,
      '/core/roles',
      '/core/roles/new',
      `/core/roles/${roleId}`,
      `/core/roles/${roleId}/edit`,
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

  it('E04-S02 the company landing lists the company settings entries the user may open, under the h1 Company settings', async () => {
    const { fetch } = companyAdmin(['core.user:read']);
    renderShellAt(`/settings/${companyId}`, shellModules, { fetch });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    await waitFor(() => expect(document.title).toBe('Company settings · Acme AB · NorthMES'));
    const main = screen.getByRole('main');
    const list = within(main).getByRole('list', { name: 'Company settings entries' });
    await waitFor(() =>
      expect(linksIn(list)).toEqual([['Users', `/settings/${companyId}/core/users`]]),
    );
    expect(main.contains(heading)).toBe(true);
    expect(crumbs()).toEqual(['Settings', 'Acme AB']);
  });

  it('E04-S02 Back to the plant leads to the plant the user came from, through the Settings button', async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin();
    renderShellAt('/plant-b/core/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });

    await user.click(
      await within(screen.getByRole('banner')).findByRole('link', { name: 'Settings' }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    const back = await screen.findByRole('link', { name: 'Back to Plant B' });
    expect(back.getAttribute('href')).toBe('/plant-b/core/articles');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('E04-S02 the skip link lands after the company settings navigation', async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin(['core.user:read']);
    renderShellAt(`/settings/${companyId}`, shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    await screen.findByRole('list', { name: 'Company settings entries' });

    await user.tab();
    expect(focusedName()).toBe('Skip to main content');
    await user.keyboard('{Enter}');
    await user.tab();

    expect(focusedName()).toBe('Users');
    expect(
      within(screen.getByRole('list', { name: 'Company settings entries' })).getByRole('link', {
        name: 'Users',
      }),
    ).toBe(document.activeElement);
  });

  it("E04-S02 leaving company settings returns the main sidebar to the user's own state", async () => {
    const user = userEvent.setup();
    const { fetch } = companyAdmin();
    renderShellAt('/plant-b/core/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    await user.click(
      await within(screen.getByRole('banner')).findByRole('link', { name: 'Settings' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    await user.click(await screen.findByRole('link', { name: 'Back to Plant B' }));

    await screen.findByRole('heading', { level: 1, name: 'Articles' });
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();
  });

  it('E04-S02 the landing of a company the user holds no role in says so, without the loading state, and leads back to the plant', async () => {
    const foreign = '019a0000-0000-7000-8000-0000000f0e10';
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: ({ companyId: asked }) =>
        asked === undefined ? viewer(['core.article:read'], ['core.user:read']) : forbidden(),
    });
    const router = renderShellAt('/plant-a/core/articles', shellModules, { fetch });
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
    expect(back.map((link) => link.getAttribute('href'))).toEqual([
      '/plant-a/core/articles',
      '/plant-a/core/articles',
    ]);
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

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    const list = await screen.findByRole('list', { name: 'Company settings entries' });
    expect(linksIn(list)).toEqual([['Users', `/settings/${companyId}/core/users`]]);
  });
});

describe('company settings below 768 px', () => {
  it('E04-S02 at 320 px the company landing shows Back to the plant above the h1 and no settings navigation (C5)', async () => {
    setViewport(320, 640);
    const user = userEvent.setup();
    const { fetch } = companyAdmin();
    renderShellAt('/plant-b/core/articles', shellModules, { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });
    await user.click(
      await within(screen.getByRole('banner')).findByRole('link', { name: 'Settings' }),
    );

    const heading = await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    const back = await within(screen.getByRole('main')).findByRole('link', {
      name: 'Back to Plant B',
    });
    expect(isBefore(back, heading)).toBe(true);
    await screen.findByRole('list', { name: 'Company settings entries' });
    expect(screen.queryByRole('navigation', { name: 'Company settings' })).toBeNull();
  });

  it('E04-S02 at 320 px a company settings page shows the link Company settings above its h1 and no settings navigation (C6)', async () => {
    setViewport(320, 640);
    const { fetch } = companyAdmin();
    renderShellAt(`/settings/${companyId}/core/users`, shellModules, { fetch });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Users' });
    const landing = await within(screen.getByRole('main')).findByRole('link', {
      name: 'Company settings',
    });
    expect(landing.getAttribute('href')).toBe(`/settings/${companyId}`);
    expect(isBefore(landing, heading)).toBe(true);
    expect(screen.queryByRole('navigation', { name: 'Company settings' })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Back to/ })).toBeNull();
  });
});
