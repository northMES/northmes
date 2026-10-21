// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the board fields page (plan 07, Board settings;
// #762): both lists using the company value, a list set for the plant with its editor, the field
// picker open, the page at 320, and the loading, empty, failed and no-access states, and the
// Gantt's hover card and Details with a saved list. The page reads the fixture G1 and keeps saved
// lists in memory, so every state is the same in every run; the preview key opens the states.

/** The board fields href of the seed plant with a search. */
function boardFields(search: Record<string, string> = {}): string {
  const href = planningLinks.settings.boardFields({ plant }).href;
  const query = new URLSearchParams(search).toString();
  return query === '' ? href : `${href}?${query}`;
}

test.describe('the board fields page', () => {
  test('ADR0021 each state of the board fields page passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(boardFields());
    await expect(page.getByRole('heading', { level: 1, name: 'Board fields' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
    await checkA11y('the board fields using the company value');

    const hover = page.getByRole('region', { name: 'Hover fields' });
    await hover.getByText('Set for Plant A').click();
    await hover.getByRole('button', { name: 'Move Article down' }).click();
    await expect(hover.getByRole('status')).toHaveText('Article moved to position 3 of 9.');
    await checkA11y('the hover fields set for the plant, one field moved');

    await hover.getByRole('button', { name: 'Add hover fields' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add hover fields' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('checkbox', { name: /^PACKING/ }).click();
    await checkA11y('the field picker open with one field chosen');
    await dialog.getByRole('button', { name: 'Add 1 field' }).click();
    await expect(dialog).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 900 });
    await checkA11y('the board fields at 320');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(boardFields({ preview: 'loading' }));
    await expect(page.getByText('Loading the board fields')).toBeVisible();
    await checkA11y('the board fields loading', { busy: true });

    await page.goto(boardFields({ preview: 'empty' }));
    await expect(page.getByText('No block fields')).toBeVisible();
    await checkA11y('the board fields with both lists empty');

    await page.goto(boardFields({ preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the board fields' }),
    ).toBeVisible();
    await checkA11y('the board fields failed');

    await page.goto(boardFields({ preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to change board fields at this plant',
      }),
    ).toBeVisible();
    await checkA11y('the board fields without access');
  });

  test('ADR0021 the Gantt with saved board fields passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(boardFields());
    const block = page.getByRole('region', { name: 'Block fields' });
    await block.getByText('Set for Plant A').click();
    await block.getByRole('button', { name: 'Add block field' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add block field' });
    await dialog.getByRole('checkbox', { name: /^ERP change/ }).click();
    await dialog.getByRole('button', { name: 'Add 1 field' }).click();
    await page.getByRole('button', { name: 'Save board fields' }).click();
    await expect(page.getByText('Board fields saved.', { exact: true }).first()).toBeVisible();

    // The saved lists live in memory, so the Gantt opens through the app's router, not a new page
    // load: Tue 3 Nov at the Day preset, where 1001.10 is a full block.
    const gantt = `${planningLinks.gantt({ plant }).href}?zoom=day&from=2026-11-03`;
    await page.evaluate((href) => {
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, gantt);
    const treegrid = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(treegrid).toBeVisible();
    await expect(treegrid.locator('[data-block="jo-1001-10"] [data-block-trailing]')).toHaveText(
      'ERP change',
    );
    await treegrid.locator('[data-block="jo-1001-10"]').hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await checkA11y('the Gantt hover card with the saved board fields');
  });
});
