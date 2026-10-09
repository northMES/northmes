// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { shellModules } from '../src/modules.ts';
import {
  companies,
  companyId,
  crumbs,
  equipment,
  fakeApi,
  focusedName,
  linksIn,
  renderShellAt,
  viewer,
} from './settings-fixtures.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** A fake API for a user with these permissions at Plant A and at Acme AB. */
function api(plantPermissions: readonly string[], companyPermissions: readonly string[] = []) {
  return fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer(plantPermissions, companyPermissions),
  });
}

describe('plant settings', () => {
  it('E04-S02 a plant route whose nav entry is in the settings area renders the plant settings navigation in main and leaves the entry out of the main sidebar', async () => {
    const { fetch } = api(['equipment.calendar:read']);
    renderShellAt('/plant-a/equipment/machines', [equipment], { fetch });

    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });
    expect(screen.getByRole('main').contains(settings)).toBe(true);
    await waitFor(() =>
      expect(linksIn(settings)).toEqual([
        ['Machines', '/plant-a/equipment/machines'],
        ['Calendars', '/plant-a/equipment/calendars'],
      ]),
    );
    expect(
      within(settings).getByRole('link', { name: 'Machines' }).getAttribute('aria-current'),
    ).toBe('page');
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(sidebar).queryByRole('link', { name: 'Machines' })).toBeNull();
    expect(within(sidebar).getByRole('link', { name: 'Tools' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Machines' })).toBeDefined();
  });

  it('E04-S02 a plant settings page keeps the plant title and adds a Settings crumb after the plant', async () => {
    const { fetch } = api([]);
    renderShellAt('/plant-a/equipment/machines', [equipment], { fetch });
    await screen.findByRole('navigation', { name: 'Plant A settings' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Settings', 'Machines']));
    expect(document.title).toBe('Machines · Plant A · NorthMES');
  });

  it('E04-S02 the plant settings navigation ends with the company settings link for a user with a company settings entry', async () => {
    const { fetch } = api([], ['core.user:read']);
    renderShellAt('/plant-a/equipment/machines', [...shellModules, equipment], { fetch });

    const settings = await screen.findByRole('navigation', { name: 'Plant A settings' });
    const company = await within(settings).findByRole('link', { name: 'Acme AB settings' });
    expect(company.getAttribute('href')).toBe(`/settings/${companyId}`);

    cleanup();
    const without = api([]);
    renderShellAt('/plant-a/equipment/machines', [...shellModules, equipment], {
      fetch: without.fetch,
    });
    const plantOnly = await screen.findByRole('navigation', { name: 'Plant A settings' });
    await waitFor(() => expect(linksIn(plantOnly).length).toBeGreaterThan(0));
    expect(within(plantOnly).queryByRole('link', { name: 'Acme AB settings' })).toBeNull();
  });

  it('E04-S02 opening a settings page collapses the main sidebar to the rail and focus goes to the page h1, as on any route change', async () => {
    const user = userEvent.setup();
    const { fetch } = api([]);
    renderShellAt('/plant-a/equipment/tools', [equipment], { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeDefined();

    await user.click(await screen.findByRole('link', { name: 'Settings' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Machines' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const trigger = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it("E04-S02 leaving settings returns the main sidebar to the user's own state, and an expand on a settings page lasts that visit", async () => {
    const user = userEvent.setup();
    const { fetch } = api(['equipment.calendar:read']);
    renderShellAt('/plant-a/equipment/tools', [equipment], { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    await user.click(await screen.findByRole('link', { name: 'Settings' }));
    await screen.findByRole('heading', { level: 1, name: 'Machines' });
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    const settings = screen.getByRole('navigation', { name: 'Plant A settings' });
    await user.click(within(settings).getByRole('link', { name: 'Calendars' }));
    await screen.findByRole('heading', { level: 1, name: 'Calendars' });
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeDefined();

    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Tools' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await user.click(await screen.findByRole('link', { name: 'Settings' }));
    await screen.findByRole('heading', { level: 1, name: 'Machines' });
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();

    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Tools' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    // The user collapsed the sidebar before going to settings, so it stays the rail.
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeDefined();
  });

  it('E04-S02 the skip link lands after the settings navigation', async () => {
    const user = userEvent.setup();
    const { fetch } = api([]);
    renderShellAt('/plant-a/equipment/machines', [equipment], { fetch });
    await screen.findByRole('navigation', { name: 'Plant A settings' });
    await screen.findByRole('heading', { level: 1, name: 'Machines' });

    await user.tab();
    expect(focusedName()).toBe('Skip to main content');
    await user.keyboard('{Enter}');
    await user.tab();

    expect(focusedName()).toBe('First control of Machines');
  });
});

describe('the Settings button', () => {
  it('E04-S02 the Settings button in the top bar opens the settings of the plant on screen, after the page actions', async () => {
    const { fetch } = api([]);
    renderShellAt('/plant-a/equipment/tools', [equipment], { fetch });
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    const button = await within(await screen.findByRole('banner')).findByRole('link', {
      name: 'Settings',
    });
    expect(button.getAttribute('href')).toBe('/plant-a/equipment/machines');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('E04-S02 a user with only company settings goes to company settings, and a user with neither sees no Settings button', async () => {
    const companyOnly = api(['core.article:read'], ['core.role:read']);
    renderShellAt('/plant-a/core/articles', shellModules, { fetch: companyOnly.fetch });

    const button = await within(await screen.findByRole('banner')).findByRole('link', {
      name: 'Settings',
    });
    expect(button.getAttribute('href')).toBe(`/settings/${companyId}`);

    cleanup();
    const neither = api(['core.article:read'], ['core.article:read']);
    renderShellAt('/plant-a/core/articles', shellModules, { fetch: neither.fetch });
    await screen.findByRole('banner');
    await waitFor(() =>
      expect(neither.seen.map(({ operationName }) => operationName)).toContain('CoreViewer'),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('E04-S02 a plant admin finds People in plant settings, and the main sidebar has no Administration group', async () => {
    const { fetch } = api(['core.user:read', 'core.role:read', 'core.roleAssignment:manage']);
    renderShellAt('/plant-a/core/articles', shellModules, { fetch });

    const button = await within(await screen.findByRole('banner')).findByRole('link', {
      name: 'Settings',
    });
    expect(button.getAttribute('href')).toBe('/plant-a/core/people');
    const sidebar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(sidebar).queryByText('Administration')).toBeNull();
    expect(linksIn(sidebar).map(([label]) => label)).not.toContain('People');
    expect(linksIn(sidebar).map(([label]) => label)).not.toContain('Users');
  });
});
