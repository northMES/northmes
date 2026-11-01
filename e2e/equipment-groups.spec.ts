// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import type { Page } from '@playwright/test';
import { seedCompany, seedPlants } from '../scripts/stack/seed.mjs';
import { expect, plant, test, uniqueCode } from './fixtures.ts';

/** The seed's plant B, where this spec makes its plant group, so plant A's list stays as the axe spec leaves it. */
const plantB = seedPlants[1]?.slug ?? '';

/**
 * Creates a group through New equipment group at `at`: its code, its name, the scope the radio
 * names and the color, when one is given, and waits for the group's page.
 */
async function newGroup(
  page: Page,
  at: string,
  { code, name, scope, color }: { code: string; name: string; scope: RegExp; color?: string },
) {
  await page.goto(coreLinks.settings.equipmentGroups.new({ plant: at }).href);
  await page.getByLabel('Code').fill(code);
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('radiogroup', { name: 'Scope' }).getByRole('radio', { name: scope }).click();
  if (color !== undefined) await page.getByRole('radio', { name: color, exact: true }).click();
  await page.getByRole('button', { name: 'Save equipment group' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `Equipment group ${code}` }),
  ).toBeVisible();
}

/** Archives or restores the group on its page, through the confirm dialog. */
async function confirm(page: Page, action: 'Archive' | 'Restore') {
  await page.getByRole('button', { name: action }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: `${action} equipment group` })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
}

test.describe('equipment groups', () => {
  test('#983 a plant group stays at its plant, a company group reaches every plant, and each is changed, archived and restored', async ({
    page,
    signIn,
  }) => {
    const local = uniqueCode('EG');
    const shared = uniqueCode('EG');
    await signIn(coreLinks.settings.equipmentGroups({ plant: plantB }).href);

    await newGroup(page, plantB, {
      code: local,
      name: `Line ${local}`,
      scope: /^Plant B$/,
      color: 'Color 7',
    });
    await expect(page.getByText('Color 7', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Edit equipment group' }).click();
    await page.getByLabel('Name', { exact: true }).fill(`Cell ${local}`);
    await page.getByRole('button', { name: 'Save equipment group' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: `Equipment group ${local}` }),
    ).toBeVisible();
    await expect(page.getByText(`Cell ${local}`).first()).toBeVisible();

    await newGroup(page, plantB, {
      code: shared,
      name: `Shared ${shared}`,
      scope: new RegExp(`^${seedCompany.name}`),
    });
    await expect(
      page.getByText(`A company group: every plant of ${seedCompany.name} may use it.`),
    ).toBeVisible();
    await expect(page.getByText(/^No color was picked/)).toBeVisible();

    // Plant A sees the company's group, not plant B's own.
    await page.goto(coreLinks.settings.equipmentGroups({ plant }).href);
    const table = page.getByRole('table', { name: 'Equipment groups of Plant A' });
    await expect(table.getByRole('link', { name: shared, exact: true })).toBeVisible();
    await expect(table.getByRole('link', { name: local, exact: true })).toHaveCount(0);

    // An archived group leaves the list until Show archived, and comes back after Restore.
    await page.goto(coreLinks.settings.equipmentGroups({ plant: plantB }).href);
    await page.getByRole('link', { name: local, exact: true }).click();
    await confirm(page, 'Archive');
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
    await page.goto(coreLinks.settings.equipmentGroups({ plant: plantB }).href);
    const listB = page.getByRole('table', { name: 'Equipment groups of Plant B' });
    await expect(listB.getByRole('link', { name: shared, exact: true })).toBeVisible();
    await expect(listB.getByRole('link', { name: local, exact: true })).toHaveCount(0);
    await page.getByLabel('Show archived').check();
    await listB.getByRole('link', { name: local, exact: true }).click();
    await confirm(page, 'Restore');
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();

    // The company's group is archived again, so plant A's list holds only what the axe spec made.
    await page.goto(coreLinks.settings.equipmentGroups({ plant }).href);
    await page.getByRole('link', { name: shared, exact: true }).click();
    await confirm(page, 'Archive');
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  });
});
