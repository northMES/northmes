// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShellModule } from '../src/modules.ts';
import { PageFrame } from '../src/ui/components/page-frame/index.ts';
import {
  companies,
  companyId,
  equipment,
  fakeApi,
  focusedName,
  isBefore,
  renderShellAt,
  setViewport,
  viewer,
} from './settings-fixtures.tsx';

afterEach(() => {
  cleanup();
  setViewport(1440, 900);
});

/** A module with one page and one help entry. */
const quality: ShellModule = {
  label: 'Quality',
  order: 30,
  links: [
    {
      label: 'Inspections',
      icon: 'ListChecks',
      link: ({ plant }) => ({ href: `/${plant}/quality/inspections` }),
    },
  ],
  module: defineWebModule({
    id: 'quality',
    version: '0.4.0',
    help: [
      {
        id: 'quality.checklists',
        label: 'Inspection checklists',
        href: 'https://docs.northmes.test/quality/checklists',
      },
    ],
    routes: (plantRoute) => {
      const qualityRoute = createRoute({ getParentRoute: () => plantRoute, path: 'quality' });
      return qualityRoute.addChildren([
        createRoute({
          getParentRoute: () => qualityRoute,
          path: 'inspections',
          component: () => <PageFrame title="Inspections">{null}</PageFrame>,
        }),
      ]);
    },
  }),
};

function renderAt(path: string) {
  const api = fakeApi({ CoreCompanies: companies, CoreViewer: () => viewer([], []) });
  return renderShellAt(path, [equipment, quality], { fetch: api.fetch });
}

/** Opens Help with the keyboard and returns the button and its menu. */
async function openHelp(user: ReturnType<typeof userEvent.setup>, within_: HTMLElement) {
  const help = within(within_).getByRole('button', { name: 'Help' });
  help.focus();
  await user.keyboard('{Enter}');
  return { help, menu: await screen.findByRole('menu') };
}

describe('the Help menu', () => {
  it('E04-S02 Help is the last stop of the top bar, after Settings, and the top bar has no Assistant while no AI provider is configured (PL26, ST31)', async () => {
    renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    const banner = screen.getByRole('banner');
    const stops = [...banner.querySelectorAll('a[href], button')].map(
      (stop) => stop.getAttribute('aria-label') ?? stop.textContent,
    );
    expect(stops.at(-1)).toBe('Help');
    const settings = within(banner).getByRole('link', { name: 'Settings' });
    expect(isBefore(settings, within(banner).getByRole('button', { name: 'Help' }))).toBe(true);
    expect(within(banner).queryByRole('button', { name: 'Assistant' })).toBeNull();
  });

  it("E04-S02 Help opens on its first entry, lists the modules' help entries under their labels, then All pages, and Escape returns focus to Help (PL8, KE15, KE16)", async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    const { help, menu } = await openHelp(user, screen.getByRole('banner'));

    expect(within(menu).getByRole('group', { name: 'Quality' })).toBeDefined();
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((item) => [item.textContent, item.getAttribute('href')]);
    expect(items).toEqual([
      ['Inspection checklists', 'https://docs.northmes.test/quality/checklists'],
      ['All pages', '/plant-a/all-pages'],
    ]);
    await waitFor(() => expect(focusedName()).toBe('Inspection checklists'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(help));
  });

  it('E04-S02 All pages lists every page the user can open by module, and focus moves to its h1', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    const { menu } = await openHelp(user, screen.getByRole('banner'));

    await user.click(within(menu).getByRole('menuitem', { name: 'All pages' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'All pages' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    await waitFor(() => expect(document.title).toBe('All pages · Plant A · NorthMES'));
    const main = screen.getByRole('main');
    const lists = within(main).getAllByRole('list');
    expect(
      lists.map((list) => [
        document.getElementById(list.getAttribute('aria-labelledby') ?? '')?.textContent,
        within(list)
          .getAllByRole('link')
          .map((link) => [link.textContent, link.getAttribute('href')]),
      ]),
    ).toEqual([
      ['Equipment', [['Tools', '/plant-a/equipment/tools']]],
      ['Quality', [['Inspections', '/plant-a/quality/inspections']]],
      ['Plant A settings', [['Machines', '/plant-a/equipment/machines']]],
    ]);
  });

  it('E04-S02 Page not found in a plant offers See all pages beside Go to the plant (NF1)', async () => {
    renderAt('/plant-a/reports');

    const link = await screen.findByRole('link', { name: 'See all pages' });
    expect(link.getAttribute('href')).toBe('/plant-a/all-pages');
  });

  it('E04-S02 at 320 px Help sits in the navigation sheet footer beside the user button, not in the top bar (D2 Sheet)', async () => {
    const user = userEvent.setup();
    setViewport(320, 640);
    renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Help' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    const sheet = await screen.findByRole('dialog');
    const account = within(sheet).getByRole('button', { name: /, account$/ });
    const help = within(sheet).getByRole('button', { name: 'Help' });
    expect(isBefore(account, help)).toBe(true);
  });

  it('E04-S02 the unknown plant page and company settings have Help before the account menu, without All pages', async () => {
    const user = userEvent.setup();
    renderAt('/plant-x/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Page not found' });
    const banner = screen.getByRole('banner');
    expect(
      isBefore(
        within(banner).getByRole('button', { name: 'Help' }),
        within(banner).getByRole('button', { name: /, account$/ }),
      ),
    ).toBe(true);
    const { menu } = await openHelp(user, banner);
    expect(within(menu).queryByRole('menuitem', { name: 'All pages' })).toBeNull();

    cleanup();
    renderAt(`/settings/${companyId}`);
    await screen.findByRole('heading', { level: 1, name: 'Company settings' });
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Help' })).toBeDefined();
  });
});
