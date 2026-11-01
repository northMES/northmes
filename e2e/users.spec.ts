// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import type { Page, Request } from '@playwright/test';
import { devUsers } from '../scripts/stack/seed.mjs';
import { expect, plant, test } from './fixtures.ts';

/** The GraphQL operation a request runs, such as `CoreUsers`. */
function operationOf(request: Request): string | undefined {
  if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/graphql')) {
    return undefined;
  }
  return (request.postDataJSON() as { operationName?: string } | null)?.operationName;
}

/**
 * Routes the answers to CoreUsers: `hold` keeps them back until pass runs, so the list stays in its
 * loading state, `empty` gives the server's answer without its rows, and `pass` leaves them alone.
 */
async function routeUsers(page: Page) {
  let mode: 'hold' | 'empty' | 'pass' = 'pass';
  let release = () => {};
  await page.route('**/graphql', async (route) => {
    if (operationOf(route.request()) !== 'CoreUsers' || mode === 'pass') {
      return route.continue();
    }
    if (mode === 'hold') {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.continue();
    }
    const response = await route.fetch();
    const body = (await response.json()) as { data?: { coreUsers?: Record<string, unknown> } };
    if (body.data?.coreUsers) {
      body.data.coreUsers = { ...body.data.coreUsers, totalCount: 0, edges: [] };
    }
    await route.fulfill({ response, json: body });
  });
  return {
    hold: () => {
      mode = 'hold';
    },
    empty: () => {
      mode = 'empty';
    },
    pass: () => {
      mode = 'pass';
      release();
    },
  };
}

const usersHref = coreLinks.settings.users({ plant }).href;

test.describe('users', () => {
  test("ADR0092 a Plant admin opens Users on the people of its plant, gives a role at its plant from a user's Access tab and removes it", async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const sara = devUsers.viewer;
    await signIn(usersHref, devUsers.plantAdmin);

    await expect(page.getByRole('button', { name: 'Place: Plant A' })).toBeVisible();
    await expect(page.getByRole('link', { name: sara.name })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New user' })).toHaveCount(0);
    await checkA11y('the users of a plant, read by a Plant admin');

    await page.getByRole('link', { name: sara.name }).click();
    await page.getByRole('tab', { name: 'Access' }).click();
    await expect(page.getByRole('table', { name: `Roles of ${sara.name}` })).toBeVisible();
    await checkA11y("a user's Access tab, read by a Plant admin");

    await page.getByRole('link', { name: 'Add role' }).click();
    await page.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: /^Planner/ }).click();
    await page.getByRole('button', { name: 'Add role' }).click();
    const remove = page.getByRole('button', { name: 'Remove Planner at Plant A' });
    await expect(remove).toBeVisible();

    await remove.click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Remove role' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(remove).toHaveCount(0);
  });

  test('ADR0092 the users list at a plant while it loads, empty and filtered to the company', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const users = await routeUsers(page);
    users.hold();
    await signIn(usersHref, devUsers.plantAdmin);
    await expect(page.locator('main [aria-busy="true"]').first()).toBeVisible();
    await checkA11y('the users list at a plant while it loads', { busy: true });
    users.pass();

    users.empty();
    await page.goto(usersHref);
    await expect(
      page.getByRole('heading', { name: 'Nobody holds a role at Plant A' }),
    ).toBeVisible();
    await checkA11y('the users list at a plant where nobody holds a role');
    users.pass();

    await page.goto(coreLinks.settings.users({ plant }, { place: 'company' }).href);
    await expect(page.getByRole('button', { name: 'Place: Demo Works' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dev admin' })).toBeVisible();
    await expect(page.getByRole('link', { name: devUsers.viewer.name })).toHaveCount(0);
    await checkA11y('the users list at a plant filtered to the company');
  });

  test('ADR0092 a planner, who reads users neither at the plant nor at the company, gets No access to Users', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(usersHref, devUsers.planner);
    await expect(page.getByRole('heading', { level: 1, name: 'No access to Users' })).toBeVisible();
    await checkA11y('No access to Users at a plant');
  });
});
