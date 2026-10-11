// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineWebModule } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
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

/** Whether Inspections, the first entry of Quality, throws while it renders. */
const inspections = { broken: false };

function InspectionsScreen() {
  if (inspections.broken)
    throw new TypeError("Cannot read properties of undefined (reading 'plan')");
  return <PageFrame title="Inspections">{null}</PageFrame>;
}

function DeviationsScreen() {
  if (deviations.broken) throw new TypeError("Cannot read properties of undefined (reading 'id')");
  return (
    <PageFrame title="Deviations">
      <p>No deviations</p>
    </PageFrame>
  );
}

/** A page that throws while it renders once Open audit has been chosen, on the same path. */
function AuditsScreen() {
  const [opened, setOpened] = useState(false);
  if (opened) throw new TypeError("Cannot read properties of undefined (reading 'lines')");
  return (
    <PageFrame title="Audits">
      <button type="button" onClick={() => setOpened(true)}>
        Open audit
      </button>
    </PageFrame>
  );
}

/**
 * A module whose second page throws while it renders, whose third throws after a click, and whose
 * first throws when a test says so.
 */
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
    {
      label: 'Audits',
      icon: 'ListChecks',
      link: ({ plant }) => ({ href: `/${plant}/quality/audits` }),
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
          component: InspectionsScreen,
        }),
        createRoute({
          getParentRoute: () => qualityRoute,
          path: 'deviations',
          component: DeviationsScreen,
        }),
        createRoute({
          getParentRoute: () => qualityRoute,
          path: 'audits',
          component: AuditsScreen,
        }),
      ]);
    },
  }),
};

/** Renders the shell at path with the modules, Equipment and Quality unless named, for a user of Acme AB. */
function renderAt(path: string, modules: readonly ShellModule[] = [equipment, quality]) {
  const api = fakeApi({
    CoreCompanies: companies,
    CoreViewer: () => viewer([], ['core.user:read']),
  });
  return renderShellAt(path, modules, { fetch: api.fetch });
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

  it('E04-S02 an unknown path under a loaded module renders the module page not found, with Go to its first entry and See all pages (D2 ST5)', async () => {
    renderAt('/plant-a/equipment/gauges');

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeDefined();
    await waitFor(() =>
      expect(main.textContent).toContain(
        'Equipment has no page at /plant-a/equipment/gauges. The link may be out of date.',
      ),
    );
    expect(within(main).getByRole('link', { name: 'Go to Tools' }).getAttribute('href')).toBe(
      '/plant-a/equipment/tools',
    );
    expect(within(main).getByRole('link', { name: 'See all pages' }).getAttribute('href')).toBe(
      '/plant-a/all-pages',
    );
    expect(crumbs()).toEqual(['Plant A', 'Equipment', 'Page not found']);
    expect(document.title).toBe('Page not found · Equipment · Plant A · NorthMES');
  });

  it('E04-S02 a link to an unknown path moves focus to the h1 Page not found', async () => {
    const router = renderAt('/plant-a/equipment/tools');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });

    router.history.push('/plant-a/equipment/gauges');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Page not found' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('E04-S02 an unknown path in company settings renders Page not found in the settings layout, with Go to Company settings (NF3)', async () => {
    renderAt(`/settings/${companyId}/reports`);

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    await waitFor(() =>
      expect(main.textContent).toContain(
        `Acme AB has no page at /settings/${companyId}/reports. The link may be out of date.`,
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
    inspections.broken = false;
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
    // The first load moves no focus, so the first Tab reaches the skip link (D2, Focus rules).
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(document.body);
  });

  it.each([
    ['the first module', [quality]],
    ['a later module', [equipment, quality]],
  ])(
    'E04-S02 the error panel of the first entry of %s leads out to See all pages, never to the page itself (shell-306 LS3)',
    async (_, modules) => {
      inspections.broken = true;
      renderAt('/plant-a/quality/inspections', modules);

      const main = await screen.findByRole('main');
      await within(main).findByRole('heading', {
        level: 1,
        name: 'Inspections could not be shown',
      });
      expect(within(main).getByRole('link', { name: 'See all pages' }).getAttribute('href')).toBe(
        '/plant-a/all-pages',
      );
      expect(within(main).queryByRole('link', { name: /^Go to / })).toBeNull();
    },
  );

  it('E04-S02 a page that throws after a click on the same path moves focus to the error panel h1 (D2 ST6)', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/quality/audits');
    await screen.findByRole('heading', { level: 1, name: 'Audits' });

    await user.click(screen.getByRole('button', { name: 'Open audit' }));

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Audits could not be shown',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
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
