// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import type { Page, Request } from '@playwright/test';
import { expect } from './fixtures.ts';

// The steps the equipment group and machine specs share: creating a group or a machine through
// its new page, and routing the API's answers to one operation to reach a page's states.

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
 * state, `empty` gives the server's list in the connection field `list` without its rows, `fail`
 * answers 500, `forbidden` the API's FORBIDDEN, and `pass` leaves them alone. A change of mode lets
 * the held ones go.
 */
export async function routeOperation(page: Page, operation: string, list?: string) {
  let mode: Mode = 'pass';
  const held: (() => void)[] = [];
  await page.route('**/graphql', async (route) => {
    if (operationOf(route.request()) !== operation || mode === 'pass') return route.fallback();
    if (mode === 'hold') {
      await new Promise<void>((resolve) => {
        held.push(resolve);
      });
      // A page.goto may have aborted the held request; its route is gone then.
      return route.fallback().catch(() => {});
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
    const body = (await response.json()) as { data?: Record<string, Record<string, unknown>> };
    const connection = list === undefined ? undefined : body.data?.[list];
    if (body.data && list !== undefined && connection) {
      body.data[list] = { ...connection, totalCount: 0, edges: [] };
    }
    return route.fulfill({ response, json: body });
  });
  return (next: Mode) => {
    mode = next;
    for (const resolve of held.splice(0)) resolve();
  };
}

/**
 * Creates a group through New equipment group at `at`: its code, its name, the scope the radio
 * names and the color, when one is given, and waits for the group's page.
 */
export async function newGroup(
  page: Page,
  at: string,
  { code, name, scope, color }: { code: string; name: string; scope: RegExp; color?: string },
) {
  await page.goto(coreLinks.settings.equipmentGroups.new({ plant: at }).href);
  await page.getByLabel('Code').fill(code);
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('radiogroup', { name: 'Scope' }).getByRole('radio', { name: scope }).click();
  // Another group of the worker's database may use the color: its radio is then "Color 3, used
  // by MACH".
  if (color !== undefined) {
    await page.getByRole('radio', { name: new RegExp(`^${color}(,|$)`) }).click();
  }
  await page.getByRole('button', { name: 'Save equipment group' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Equipment group ${code}` }),
  ).toBeVisible();
}

/**
 * Creates a machine through New machine at `at`, in the group whose option `group` names, such as
 * "Machining (MACH)", plannable unless said otherwise, and waits for the machine's page.
 */
export async function newMachine(
  page: Page,
  at: string,
  {
    code,
    name,
    group,
    plannable = true,
  }: { code: string; name: string; group: string; plannable?: boolean },
) {
  await page.goto(coreLinks.settings.machines.new({ plant: at }).href);
  await page.getByLabel('Code').fill(code);
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Equipment group').selectOption({ label: group });
  if (!plannable) await page.getByRole('checkbox', { name: /^Plannable/ }).click();
  await page.getByRole('button', { name: 'Save machine' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Machine ${code}` })).toBeVisible();
}

/** Archives or restores the group or machine on its page, through the confirm dialog. */
export async function confirm(
  page: Page,
  action: 'Archive' | 'Restore',
  label: 'equipment group' | 'machine',
) {
  await page.getByRole('button', { name: action, exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: `${action} ${label}` })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
}
