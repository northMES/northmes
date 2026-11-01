// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { shellModules } from '../src/modules.ts';
import { alexEmail, fakeSession } from './auth/fake-session.ts';
import {
  companies,
  companyId,
  fakeApi,
  linksIn,
  renderShellAt,
  unreachable,
  viewer,
} from './settings-fixtures.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.title = '';
});

// Fictional data: Acme AB with Plant A and Plant B, and Nordic Steel with Plant N.

const nordicId = '019a0000-0000-7000-8000-0000000bc3e0';

const nordic = {
  __typename: 'Company',
  id: nordicId,
  name: 'Nordic Steel',
  plants: [
    {
      __typename: 'Plant',
      id: '019a0000-0000-7000-8000-00000000b1a0',
      slug: 'plant-n',
      name: 'Plant N',
    },
  ],
};

/** coreCompanies: Acme AB with the plants of `slugs` among Plant A and Plant B, and `others`. */
function companiesWith(slugs: readonly string[], others: readonly object[] = []) {
  const [acme] = companies().coreCompanies;
  return {
    coreCompanies: [
      { ...acme, plants: acme?.plants.filter(({ slug }) => slugs.includes(slug)) ?? [] },
      ...others,
    ],
  };
}

/** The fake API of a user with these companies, who holds companyPermissions at Acme AB. */
function api(answer: () => unknown, companyPermissions: readonly string[] = []) {
  return fakeApi({
    CoreCompanies: answer,
    CoreViewer: ({ companyId: asked }) => viewer([], asked === companyId ? companyPermissions : []),
  });
}

/** Permissions that give a Company admin of Acme AB the Users and Roles pages of its settings. */
const companyAdmin = ['core.role:read', 'core.user:read'];

describe('the landing at /', () => {
  it('ADR0066 two plants show the plant list at /: the h1 Your plants and an h2 per company with its plants', async () => {
    const { fetch } = api(() => companiesWith(['plant-a', 'plant-b'], [nordic]));
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', { level: 1, name: 'Your plants' }),
    ).toBeDefined();
    expect(document.title).toBe('Your plants · NorthMES');
    const acme = await within(main).findByRole('list', { name: 'Acme AB' });
    expect(linksIn(acme)).toEqual([
      ['Plant A', coreLinks.dashboard({ plant: 'plant-a' }).href],
      ['Plant B', coreLinks.dashboard({ plant: 'plant-b' }).href],
    ]);
    expect(linksIn(within(main).getByRole('list', { name: 'Nordic Steel' }))).toEqual([
      ['Plant N', coreLinks.dashboard({ plant: 'plant-n' }).href],
    ]);
    expect(within(main).getByRole('heading', { level: 2, name: 'Acme AB' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Page not found' })).toBeNull();
  });

  it("ADR0066 without a module with sidebar entries, each plant link on the plant list opens the plant's root", async () => {
    const { fetch } = api(() => companiesWith(['plant-a', 'plant-b']));
    renderShellAt('/', [], { fetch });

    const acme = await screen.findByRole('list', { name: 'Acme AB' });
    expect(linksIn(acme)).toEqual([
      ['Plant A', '/plant-a'],
      ['Plant B', '/plant-b'],
    ]);
  });

  it("#876 the plant list links each company's settings, its first page the user may open under its first plant, where the user has one", async () => {
    const { fetch } = api(() => companiesWith(['plant-a'], [nordic]), companyAdmin);
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    await within(main).findByRole('list', { name: 'Acme AB' });
    expect(
      (await within(main).findByRole('link', { name: 'Acme AB settings' })).getAttribute('href'),
    ).toBe(coreLinks.settings.users({ plant: 'plant-a' }).href);
    expect(within(main).queryByRole('link', { name: 'Nordic Steel settings' })).toBeNull();
  });

  it('ADR0092 the plant list links the company settings of a user who reads users only at its first plant, to Users', async () => {
    const [acme] = companies().coreCompanies;
    const plantA = acme?.plants[0]?.id ?? '';
    const { fetch } = fakeApi({
      CoreCompanies: () => companiesWith(['plant-a', 'plant-b']),
      CoreViewer: () => viewer([], [], { [plantA]: ['core.user:read'] }),
    });
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    expect(
      (await within(main).findByRole('link', { name: 'Acme AB settings' })).getAttribute('href'),
    ).toBe(coreLinks.settings.users({ plant: 'plant-a' }).href);
  });

  // The target size of the plant and settings links (WCAG 2.5.8) is read from the boxes the browser
  // lays out in e2e/design-rules.spec.ts.

  it('ADR0066 one plant and no company settings page redirects / to that plant', async () => {
    const { fetch } = api(() => companiesWith(['plant-a']));
    const router = renderShellAt('/', shellModules, { fetch });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(coreLinks.dashboard({ plant: 'plant-a' }).href),
    );
  });

  it("#876 one plant redirects / to that plant without reading the company's permissions, so a failed read of them cannot hold the user back", async () => {
    const { fetch } = fakeApi({
      CoreCompanies: () => companiesWith(['plant-a']),
      CoreViewer: () => unreachable,
    });
    const router = renderShellAt('/', shellModules, { fetch });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(coreLinks.dashboard({ plant: 'plant-a' }).href),
    );
  });

  it('ADR0066 one plant and a company settings page redirects / to that plant too (#872)', async () => {
    const { fetch } = api(() => companiesWith(['plant-a']), companyAdmin);
    const router = renderShellAt('/', shellModules, { fetch });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(coreLinks.dashboard({ plant: 'plant-a' }).href),
    );
  });

  it("#876 one plant at Acme AB and a company settings page at Nordic Steel, which has no plant, redirects / to the plant: the company's pages sit under its plants", async () => {
    const { fetch } = fakeApi({
      CoreCompanies: () => companiesWith(['plant-a'], [{ ...nordic, plants: [] }]),
      CoreViewer: ({ companyId: asked }) => viewer([], asked === nordicId ? companyAdmin : []),
    });
    const router = renderShellAt('/', shellModules, { fetch });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(coreLinks.dashboard({ plant: 'plant-a' }).href),
    );
  });

  it('ADR0066 with several plants the landing asks the user to pick the plant to work in (#872)', async () => {
    const { fetch } = api(() => companiesWith(['plant-a', 'plant-b']));
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    await within(main).findByRole('heading', { level: 1, name: 'Your plants' });
    expect(within(main).getByText('Pick the plant to work in.')).toBeDefined();
  });

  it("#876 no plant and a company settings page says that no plant is assigned yet: the company's pages sit under its plants", async () => {
    const { fetch } = fakeApi({
      CoreCompanies: () => companiesWith([], [{ ...nordic, plants: [] }]),
      CoreViewer: () => viewer([], companyAdmin),
    });
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    expect(await within(main).findByText('No plant is assigned to you yet.')).toBeDefined();
    expect(within(main).queryByRole('link')).toBeNull();
  });

  it('ADR0066 no plant and no company settings page says that no plant is assigned yet', async () => {
    const { fetch } = api(() => ({ coreCompanies: [] }));
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    expect(await within(main).findByText('No plant is assigned to you yet.')).toBeDefined();
    expect(within(main).getByRole('heading', { level: 1, name: 'Your plants' })).toBeDefined();
    expect(within(main).queryByRole('link')).toBeNull();
  });

  it('ADR0066 the page without a plant has the account menu, so the user can sign out', async () => {
    const { fetch } = api(() => ({ coreCompanies: [] }));
    renderShellAt('/', shellModules, { fetch });

    await screen.findByText('No plant is assigned to you yet.');
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /Alex Lund/ }),
    ).toBeDefined();
  });

  it('ADR0066 a failed read of the plants at / shows the error panel with Try again, and the account menu', async () => {
    const { fetch } = fakeApi({ CoreCompanies: () => unreachable });
    renderShellAt('/', shellModules, { fetch });

    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('button', { name: 'Try again' })).toBeDefined();
    expect(within(main).getByRole('heading', { level: 1 })).toBeDefined();
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: /Alex Lund/ }),
    ).toBeDefined();
  });

  it('ADR0066 a viewer without a session who opens / gets the sign-in page with / as the return path', async () => {
    const { fetch } = api(() => companiesWith(['plant-a', 'plant-b']));
    const router = renderShellAt('/', shellModules, {
      fetch,
      session: fakeSession({ signedIn: false }),
    });

    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toEqual({ redirect: '/' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('#648 signing in at /sign-in without a return path lands on Your plants, not Page not found', async () => {
    const user = userEvent.setup();
    const { fetch } = api(() => companiesWith(['plant-a', 'plant-b']));
    renderShellAt('/sign-in', shellModules, { fetch, session: fakeSession({ signedIn: false }) });

    await user.type(await screen.findByLabelText('Email'), alexEmail);
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Your plants' })).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Page not found' })).toBeNull();
  });
});
