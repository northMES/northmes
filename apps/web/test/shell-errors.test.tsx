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
  crumbs,
  equipment,
  fakeApi,
  focusedName,
  renderShellAt,
  viewer,
} from './settings-fixtures.tsx';

afterEach(cleanup);

/** Whether Deviations throws while it renders, as a fault in a module's code does. */
const deviations = { broken: true };

function DeviationsScreen() {
  if (deviations.broken) throw new TypeError("Cannot read properties of undefined (reading 'id')");
  return (
    <PageFrame title="Deviations">
      <p>No deviations</p>
    </PageFrame>
  );
}

/** A module whose second page throws while it renders. */
const quality: ShellModule = {
  label: 'Quality',
  order: 30,
  links: [
    {
      label: 'Inspections',
      icon: 'ListChecks',
      link: ({ plant }) => ({ href: `/${plant}/quality/inspections` }),
    },
    {
      label: 'Deviations',
      icon: 'ClipboardList',
      link: ({ plant }) => ({ href: `/${plant}/quality/deviations` }),
    },
  ],
  module: defineWebModule({
    id: 'quality',
    version: '0.4.0',
    routes: (plantRoute) => {
      const qualityRoute = createRoute({ getParentRoute: () => plantRoute, path: 'quality' });
      return qualityRoute.addChildren([
        createRoute({
          getParentRoute: () => qualityRoute,
          path: 'inspections',
          component: () => <PageFrame title="Inspections">{null}</PageFrame>,
        }),
        createRoute({
          getParentRoute: () => qualityRoute,
          path: 'deviations',
          component: DeviationsScreen,
        }),
      ]);
    },
  }),
};

/** Renders the shell at path with Equipment and Quality, for a user of Acme AB. */
function renderAt(path: string) {
  const api = fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer([], ['core.user:read']),
  });
  return renderShellAt(path, [equipment, quality], { fetch: api.fetch });
}

/** The label and value of each row of a description list. */
function rowsIn(element: HTMLElement): (string | null)[][] {
  const terms = within(element).getAllByRole('term');
  return terms.map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null]);
}

describe('an unknown path', () => {
  it('E04-S02 an unknown path in a plant renders Page not found inside the plant layout, with Go to the plant (NF1)', async () => {
    renderAt('/plant-a/reports');

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
    await waitFor(() =>
      expect(main.textContent).toContain(
        'Plant A has no page at /plant-a/reports. The link may be out of date.',
      ),
    );
    expect(within(main).getByRole('link', { name: 'Go to Plant A' }).getAttribute('href')).toBe(
      '/plant-a/equipment/tools',
    );
    expect(crumbs()).toEqual(['Plant A', 'Page not found']);
    expect(document.title).toBe('Page not found · Plant A · NorthMES');
  });

  it('E04-S02 a link to an unknown path moves focus to the h1 Page not found', async () => {
    const router = renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    await router.navigate({ href: '/plant-a/equipment/gauges' });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Page not found' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('E04-S02 an unknown path in company settings renders Page not found in the settings layout, with Go to Company settings (NF3)', async () => {
    renderAt(`/settings/${companyId}/core/reports`);

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    await waitFor(() =>
      expect(main.textContent).toContain(
        `Acme AB has no page at /settings/${companyId}/core/reports. The link may be out of date.`,
      ),
    );
    expect(
      within(main).getByRole('link', { name: 'Go to Company settings' }).getAttribute('href'),
    ).toBe(`/settings/${companyId}`);
    expect(document.title).toBe('Page not found · Acme AB · NorthMES');
  });
});

describe('a page that throws while it renders', () => {
  afterEach(() => {
    deviations.broken = true;
  });

  it('E04-S02 the error panel replaces the page inside the shell, with the correlation id, the stage and the code (D2 ST6)', async () => {
    renderAt('/plant-a/quality/deviations');

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 1, name: 'Deviations could not be shown' }),
    ).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
    expect(main.textContent).toContain(
      'This page stopped with an error while it was drawn. Saved data is not affected.',
    );
    expect(main.textContent).toContain(
      'Try again. If the error comes back, give your plant admin the correlation id.',
    );
    const [correlation, ...rows] = rowsIn(main);
    expect(correlation?.[0]).toBe('Correlation id');
    expect(correlation?.[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows).toEqual([
      ['Stage', 'render'],
      ['Code', 'web.render_error'],
    ]);
    expect(within(main).getByRole('button', { name: 'Copy correlation id' })).toBeDefined();
    expect(within(main).getByRole('link', { name: 'Go to Inspections' }).getAttribute('href')).toBe(
      '/plant-a/quality/inspections',
    );
    await waitFor(() =>
      expect(document.title).toBe('Deviations could not be shown · Plant A · NorthMES'),
    );
  });

  it('E04-S02 Try again renders the page again, and focus moves to its h1', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/quality/deviations');
    const tryAgain = await screen.findByRole('button', { name: 'Try again' });
    deviations.broken = false;

    await user.click(tryAgain);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Deviations' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(focusedName()).toBe('Deviations');
  });
});
