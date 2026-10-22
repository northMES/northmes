// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the material warning on the order Gantt (design #729, MW1 to
// MW3): the week with 1004.10 material short, its hover card with the material line, and its
// Details with the Material section. The Gantt reads the fixture G1, so the warning is the same in
// every run.

test.describe('the material warning on the order Gantt', () => {
  test('#729 ADR0021 the material warning, its hover card and its Details pass the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningLinks.gantt({ plant }, { zoom: 'week', from: '2026-11-02' }).href);
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    const block = gantt.locator('[data-block="jo-1004-10"]');
    await expect(block.locator('[data-material-cue]')).toHaveCount(1);
    await checkA11y('the Gantt with a job order material short');

    await block.hover();
    const card = page.getByRole('tooltip');
    await expect(card.getByText('Material short')).toBeVisible();
    await expect(card).toHaveCSS('opacity', '1');
    await checkA11y('the hover card of a job order material short');

    await block.click();
    const drawer = page.locator('[role="dialog"][data-details-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS('opacity', '1');
    await expect(drawer.getByRole('region', { name: 'Material' })).toBeVisible();
    await checkA11y('the Material section in Details');
  });
});
