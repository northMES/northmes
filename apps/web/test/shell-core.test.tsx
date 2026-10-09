// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { shellModules } from '../src/modules.ts';
import { wayOutOf } from '../src/shell/shell-pages.ts';
import {
  companies,
  companyId,
  crumbs,
  equipment,
  fakeApi,
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
  it('E04-S02 the breadcrumb of a core page has no module crumb: Plant A, then the page', async () => {
    renderShellAt('/plant-a/articles', shellModules, { fetch: api().fetch });
    await screen.findByRole('heading', { level: 1, name: 'Articles' });

    await waitFor(() => expect(crumbs()).toEqual(['Plant A', 'Articles']));
    expect(document.title).toBe('Articles · Plant A · NorthMES');
  });

  it('E04-S02 the breadcrumb of a core plant settings page reads Plant A, Settings, then the page', async () => {
    renderShellAt('/plant-a/people', shellModules, { fetch: api().fetch });
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
      '/plant-a/articles',
    );
    expect(crumbs()).toEqual(['Plant A', 'Page not found']);
    expect(document.title).toBe('Page not found · Plant A · NorthMES');
  });

  it("E04-S02 the way out of a core page that failed is core's first entry, or See all pages on that entry itself", () => {
    expect(wayOutOf(shellModules, { plant: 'plant-a' }, `/plant-a/articles/${articleId}`)).toEqual({
      label: 'Go to Articles',
      href: '/plant-a/articles',
    });
    expect(wayOutOf(shellModules, { plant: 'plant-a' }, '/plant-a/articles')).toEqual({
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

  it('E04-S02 company settings of core sit at the company settings root', async () => {
    renderShellAt(`/settings/${companyId}/users`, shellModules, { fetch: api().fetch });

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    await waitFor(() => expect(crumbs()).toEqual(['Settings', 'Acme AB', 'Users']));
  });
});
