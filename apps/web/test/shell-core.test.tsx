// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { shellModules } from '../src/modules.ts';
import { wayOutOf } from '../src/shell/shell-pages.ts';
import {
  companies,
  crumbs,
  equipment,
  fakeApi,
  isBefore,
  renderShellAt,
  viewer,
} from './settings-fixtures.tsx';

afterEach(cleanup);

/** A fake API for a user who reads articles and people at Plant A and users at Acme AB. */
function api() {
  return fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer(['core.article:read', 'core.user:read'], ['core.user:read']),
  });
}

const articleId = '019a0000-0000-7000-8000-0000000a0001';

describe("core's pages at the plant root (ADR 0074)", () => {
  it('E04-S02 the breadcrumb of a core page has no module crumb: Plant A, Master data, then the page', async () => {
    renderShellAt('/plant-a/articles', shellModules, { fetch: api().fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Master data', 'Articles']));
    expect(document.title).toBe('Articles · Plant A · NorthMES');
  });

  it('E04-S02 the breadcrumb of a page under Articles reads Plant A, Master data, Articles, then the page', async () => {
    renderShellAt('/plant-a/articles/new', shellModules, { fetch: api().fetch });
    await screen.findByRole('heading', { level: 1, name: 'New article' });

    await waitFor(() =>
      expect(crumbs()).toEqual(['Plant A', 'Master data', 'Articles', 'New article']),
    );
  });

  it("E04-S02 Articles sits under Master data in core's sidebar group (D2 PL5, ui-222 LI1)", async () => {
    renderShellAt('/plant-a/articles', shellModules, { fetch: api().fetch });
    const sidebar = await screen.findByRole('navigation', { name: 'Main' });
    const core = within(sidebar).getByRole('list', { name: 'Core' });

    const masterData = within(core).getByRole('button', { name: 'Master data' });
    expect(masterData.getAttribute('aria-expanded')).toBe('true');
    const articles = within(core).getByRole('link', { name: 'Articles' });
    expect(isBefore(masterData, articles)).toBe(true);
    expect(masterData.closest('li')?.contains(articles)).toBe(true);
  });

  it('E04-S02 Dashboard, the entry at the plant root, is not current and not marked on the articles list under the root (#873)', async () => {
    renderShellAt('/plant-a/articles', shellModules, { fetch: api().fetch });
    const sidebar = await screen.findByRole('navigation', { name: 'Main' });
    const core = within(sidebar).getByRole('list', { name: 'Core' });

    expect(within(core).getByRole('link', { name: 'Articles' }).getAttribute('aria-current')).toBe(
      'page',
    );
    const dashboard = within(core).getByRole('link', { name: 'Dashboard' });
    expect(dashboard.getAttribute('aria-current')).toBeNull();
    expect(dashboard.hasAttribute('data-active')).toBe(false);
  });

  it('E04-S02 Dashboard is current and marked on the dashboard, also at the root with a trailing slash (#873)', async () => {
    for (const path of ['/plant-a', '/plant-a/']) {
      cleanup();
      renderShellAt(path, shellModules, { fetch: api().fetch });
      const sidebar = await screen.findByRole('navigation', { name: 'Main' });
      const dashboard = within(sidebar).getByRole('link', { name: 'Dashboard' });
      expect(dashboard.getAttribute('aria-current'), path).toBe('page');
      expect(dashboard.hasAttribute('data-active'), path).toBe(true);
    }
  });

  it('E04-S02 the breadcrumb of a core plant settings page reads Plant A, Settings, then the page', async () => {
    renderShellAt('/plant-a/settings/people', shellModules, { fetch: api().fetch });
    await screen.findByRole('navigation', { name: 'Plant A settings' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Settings', 'People']));
  });

  it('E04-S02 the breadcrumb of another module keeps its module crumb beside core at the plant root', async () => {
    renderShellAt('/plant-a/equipment/tools', [...shellModules, equipment], {
      fetch: api().fetch,
    });
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Equipment', 'Tools']));
  });

  it('E04-S02 an unknown path under the plant, with core loaded, is Page not found of the plant, with Go to Plant A', async () => {
    renderShellAt('/plant-a/reports', shellModules, { fetch: api().fetch });

    const main = await screen.findByRole('main');
    await within(main).findByRole('heading', { level: 1, name: 'Page not found' });
    await waitFor(() =>
      expect(main.textContent).toContain(
        'Plant A has no page at /plant-a/reports. The link may be out of date.',
      ),
    );
    expect(within(main).getByRole('link', { name: 'Go to Plant A' }).getAttribute('href')).toBe(
      '/plant-a',
    );
    expect(crumbs()).toEqual(['Plant A', 'Page not found']);
    expect(document.title).toBe('Page not found · Plant A · NorthMES');
  });

  it('#876 the way out of a settings page that failed is the settings landing, and the landing has none', () => {
    for (const path of ['/plant-a/settings/users', '/plant-a/settings/people/u-1']) {
      expect(wayOutOf(shellModules, { plant: 'plant-a' }, path)).toEqual({
        label: 'Go to Settings',
        href: '/plant-a/settings',
      });
    }
    expect(wayOutOf(shellModules, { plant: 'plant-a' }, '/plant-a/settings')).toBeUndefined();
  });

  it("E04-S02 the way out of a core page that failed is core's first entry, or See all pages on that entry itself", () => {
    expect(wayOutOf(shellModules, { plant: 'plant-a' }, `/plant-a/articles/${articleId}`)).toEqual({
      label: 'Go to Dashboard',
      href: '/plant-a',
    });
    expect(wayOutOf(shellModules, { plant: 'plant-a' }, '/plant-a')).toEqual({
      label: 'See all pages',
      href: '/plant-a/all-pages',
    });
    expect(wayOutOf(shellModules, { plant: 'plant-a' }, '/plant-a/planning/board')).toEqual({
      label: 'See all pages',
      href: '/plant-a/all-pages',
    });
  });

  it("E04-S02 the plant switcher leads from an article to the other plant's articles list", async () => {
    const user = userEvent.setup();
    renderShellAt(`/plant-a/articles/${articleId}`, shellModules, { fetch: api().fetch });
    const sidebar = await screen.findByRole('navigation', { name: 'Main' });

    await user.click(await within(sidebar).findByRole('button', { name: /switch plant$/ }));

    const plantB = await screen.findByRole('menuitem', { name: 'Plant B' });
    expect(plantB.getAttribute('href')).toBe('/plant-b/articles');
  });

  it("#876 core's settings pages sit at the settings root under the plant, the company's pages included", async () => {
    renderShellAt('/plant-a/settings/users', shellModules, { fetch: api().fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Settings', 'Users']));
  });
});
