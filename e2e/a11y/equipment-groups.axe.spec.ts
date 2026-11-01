// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import type { Page, Request } from '@playwright/test';
import { seedCompany } from '../../scripts/stack/seed.mjs';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the equipment groups pages (design #729, EG1 to EG9): the new
// group form, a group's page, the list with its Scope menu open, the edit form with a color
// picked, the archive dialog, the list, the page and the form at 320 px, the list's loading,
// empty, failed and no-access states, a group's loading, failed and no-access states, a group that
// does not exist, and the edit form loading. The spec makes the plant group MACH and the company
// group HEAT at plant A, the fixture G1's codes, so the pages show G1's machines in them and the
// screenshots are the same in every run; the states come from routing the API's answers.

/** The GraphQL operation a request runs, such as `CoreEquipmentGroups`. */
function operationOf(request: Request): string | undefined {
  if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/graphql')) {
    return undefined;
  }
  return (request.postDataJSON() as { operationName?: string } | null)?.operationName;
}

type Mode = 'pass' | 'hold' | 'empty' | 'fail' | 'forbidden';

/**
 * Routes the answers to `operation`: `hold` keeps them back, so the page stays in its loading
 * state, `empty` gives the server's list without its rows, `fail` answers 500, `forbidden` the
 * API's FORBIDDEN, and `pass` leaves them alone. A change of mode lets the held ones go.
 */
async function routeOperation(page: Page, operation: string) {
  let mode: Mode = 'pass';
  const held: (() => void)[] = [];
  await page.route('**/graphql', async (route) => {
    if (operationOf(route.request()) !== operation || mode === 'pass') return route.fallback();
    if (mode === 'hold') {
      await new Promise<void>((resolve) => {
        held.push(resolve);
      });
      return route.fallback();
    }
    if (mode === 'fail') return route.fulfill({ status: 500, body: 'Internal Server Error' });
    if (mode === 'forbidden') {
      return route.fulfill({
        json: {
          data: null,
          errors: [
            {
              message: 'Forbidden',
              extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
            },
          ],
        },
      });
    }
    const response = await route.fetch();
    const body = (await response.json()) as {
      data?: { coreEquipmentGroups?: Record<string, unknown> };
    };
    if (body.data?.coreEquipmentGroups) {
      body.data.coreEquipmentGroups = {
        ...body.data.coreEquipmentGroups,
        totalCount: 0,
        edges: [],
      };
    }
    return route.fulfill({ response, json: body });
  });
  return (next: Mode) => {
    mode = next;
    for (const resolve of held.splice(0)) resolve();
  };
}

/** Creates a group through New equipment group at plant A and waits for its page. */
async function newGroup(
  page: Page,
  { code, name, scope, color }: { code: string; name: string; scope: RegExp; color?: string },
) {
  await page.goto(coreLinks.settings.equipmentGroups.new({ plant }).href);
  await page.getByLabel('Code').fill(code);
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('radiogroup', { name: 'Scope' }).getByRole('radio', { name: scope }).click();
  if (color !== undefined) await page.getByRole('radio', { name: color, exact: true }).click();
  await page.getByRole('button', { name: 'Save equipment group' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Equipment group ${code}` }),
  ).toBeVisible();
}

test.describe('the equipment groups pages', () => {
  test('#983 ADR0021 each state of the equipment groups pages passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const groups = coreLinks.settings.equipmentGroups({ plant }).href;
    const list = await routeOperation(page, 'CoreEquipmentGroups');
    const one = await routeOperation(page, 'CoreEquipmentGroup');
    await signIn(coreLinks.settings.equipmentGroups.new({ plant }).href);
    await expect(page.getByRole('radiogroup', { name: 'Scope' })).toBeVisible();
    await checkA11y('the new equipment group form');

    await newGroup(page, {
      code: 'HEAT',
      name: 'Heat treatment',
      scope: new RegExp(`^${seedCompany.name}`),
    });
    await newGroup(page, { code: 'MACH', name: 'Machining', scope: /^Plant A$/, color: 'Color 3' });
    const mach = page.url();
    await expect(page.getByRole('table', { name: 'Machines in MACH' })).toBeVisible();
    await checkA11y('an equipment group');

    await page.goto(groups);
    await expect(page.getByRole('table', { name: 'Equipment groups of Plant A' })).toBeVisible();
    await checkA11y('the equipment groups list');
    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Scope/ }).click();
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
    await checkA11y('the Scope menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.goto(mach);
    await page.getByRole('link', { name: 'Edit equipment group' }).click();
    await page.getByRole('radio', { name: 'Color 12' }).click();
    await expect(page.getByRole('radio', { name: 'Color 12' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await checkA11y('the edit form with a color picked');
    const edit = page.url();

    await page.goto(mach);
    await page.getByRole('button', { name: 'Archive' }).click();
    // The dialog fades in; axe reads its text against the page until it has (#867).
    await expect(page.getByRole('alertdialog')).toHaveCSS('opacity', '1');
    await checkA11y('the archive dialog');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // At 320 px the list and the group's machines scroll sideways in focusable regions.
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(groups);
    await expect(
      page.getByRole('region', { name: 'Equipment groups, scrolls sideways' }),
    ).toBeVisible();
    await checkA11y('the equipment groups list at 320 px');
    await page.goto(mach);
    await expect(
      page.getByRole('region', { name: 'Machines in MACH, scrolls sideways' }),
    ).toBeVisible();
    await checkA11y('an equipment group at 320 px');
    await page.goto(edit);
    await expect(page.getByRole('radiogroup', { name: 'Color' })).toBeVisible();
    await checkA11y('the edit form at 320 px');
    await page.setViewportSize({ width: 1440, height: 900 });

    list('hold');
    await page.goto(groups);
    await expect(page.getByRole('table', { name: 'Equipment groups' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await checkA11y('the equipment groups list loading', { busy: true });

    list('empty');
    await page.goto(groups);
    await expect(
      page.getByRole('heading', { level: 2, name: 'No equipment groups yet' }),
    ).toBeVisible();
    await checkA11y('the equipment groups list empty');

    list('fail');
    await page.goto(groups);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load equipment groups' }),
    ).toBeVisible();
    await checkA11y('the equipment groups list failed');

    list('forbidden');
    await page.goto(groups);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read equipment groups in Plant A',
      }),
    ).toBeVisible();
    await checkA11y('the equipment groups list without access');
    list('pass');

    one('hold');
    await page.goto(edit);
    await expect(page.getByText('Loading the equipment group.')).toBeVisible();
    await checkA11y('the edit form loading', { busy: true });

    await page.goto(mach);
    await expect(page.getByRole('heading', { level: 1, name: 'Equipment group' })).toBeVisible();
    // The page frame marks the loading group busy; it draws no skeleton, so the busy element is
    // empty and never visible.
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(1);
    await checkA11y('an equipment group loading', { busy: true });

    one('fail');
    await page.goto(mach);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the equipment group' }),
    ).toBeVisible();
    await checkA11y('an equipment group failed');

    one('forbidden');
    await page.goto(mach);
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to read equipment groups in Plant A',
      }),
    ).toBeVisible();
    await checkA11y('an equipment group without access');
    one('pass');

    await page.goto(
      coreLinks.settings.equipmentGroups.group({
        plant,
        groupId: '019a0000-0000-7000-8000-0000000000ff',
      }).href,
    );
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'This equipment group does not exist or you cannot see it',
      }),
    ).toBeVisible();
    await checkA11y('an equipment group that does not exist');
  });
});
