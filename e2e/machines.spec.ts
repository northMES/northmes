// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { seedPlants } from '../scripts/stack/seed.mjs';
import { confirm, newGroup, newMachine } from './equipment.ts';
import { expect, test, uniqueCode } from './fixtures.ts';

/** The seed's plant B, where this spec makes its machines, so plant A's list stays as the axe spec leaves it. */
const plantB = seedPlants[1]?.slug ?? '';

test.describe('machines', () => {
  test('#991 a machine is created in a group, changed, archived and restored, and its group lists it', async ({
    page,
    signIn,
  }) => {
    const groupCode = uniqueCode('EG');
    const code = uniqueCode('M');
    await signIn(coreLinks.settings.machines({ plant: plantB }).href);
    await newGroup(page, plantB, {
      code: groupCode,
      name: `Line ${groupCode}`,
      scope: /^Plant B$/,
    });
    const groupPage = page.url();

    await newMachine(page, plantB, {
      code,
      name: `Press ${code}`,
      group: `Line ${groupCode} (${groupCode})`,
    });
    const machinePage = page.url();
    await expect(page.getByText(`Press ${code}, Line ${groupCode}`)).toBeVisible();

    await page.getByRole('link', { name: 'Edit machine' }).click();
    await page.getByLabel('Name', { exact: true }).fill(`Cell ${code}`);
    await page.getByRole('checkbox', { name: /^Plannable/ }).click();
    await page.getByRole('radio', { name: 'Own color' }).click();
    await page
      .getByRole('radiogroup', { name: 'Own color' })
      .getByRole('radio', { name: 'Color 9' })
      .click();
    await page.getByRole('button', { name: 'Save machine' }).click();
    await expect(page).toHaveURL(machinePage);
    await expect(page.getByText(`Cell ${code}, Line ${groupCode}`)).toBeVisible();
    await expect(page.getByText('Color 9, its own')).toBeVisible();

    await page.goto(groupPage);
    const inGroup = page.getByRole('table', { name: `Machines in ${groupCode}` });
    await expect(inGroup.getByRole('link', { name: code, exact: true })).toBeVisible();

    // An archived machine leaves the list until Show archived, and comes back after Restore.
    await page.goto(machinePage);
    await confirm(page, 'Archive', 'machine');
    await page.goto(coreLinks.settings.machines({ plant: plantB }).href);
    // The list has loaded once its status line counts the machines; the toolbar keeps it in the
    // empty state too, as plant B may have no other machine.
    await expect(page.locator('[data-list-status]')).toContainText('Sorted by code');
    await expect(page.getByRole('link', { name: code, exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Show archived' }).click();
    await page
      .getByRole('table', { name: 'Machines' })
      .getByRole('link', { name: code, exact: true })
      .click();
    await confirm(page, 'Restore', 'machine');
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
  });
});
