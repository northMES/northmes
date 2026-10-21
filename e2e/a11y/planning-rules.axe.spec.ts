// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The axe check of ADR 0021 over the states of the planning rules page (plan 07, Settings; #766):
// the rules of Plant A as G1 sets them, the error summary after a refused Save, the page at 320,
// a saved rule, and the loading, failed and no-access states. The page reads the fixture G1 and
// keeps saved rules in memory, so every state is the same in every run; the preview key opens the
// states.

/** The planning rules href of the seed plant with a search. */
function planningRules(search: Record<string, string> = {}): string {
  const href = planningLinks.settings({ plant }).href;
  const query = new URLSearchParams(search).toString();
  return query === '' ? href : `${href}?${query}`;
}

test.describe('the planning rules page', () => {
  test('ADR0021 each state of the planning rules page passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningRules());
    await expect(page.getByRole('heading', { level: 1, name: 'Planning rules' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Frozen window' })).toBeVisible();
    await checkA11y('the planning rules of Plant A');

    const frozen = page.getByRole('region', { name: 'Frozen window' });
    await frozen.getByRole('textbox', { name: /Frozen window at Plant A/ }).fill('');
    await page.getByRole('button', { name: 'Save planning rules' }).click();
    await expect(page.getByRole('group', { name: '1 rule needs a change' })).toBeFocused();
    await checkA11y('the planning rules with a refused Save');

    await page.setViewportSize({ width: 320, height: 900 });
    await checkA11y('the planning rules at 320');
    await page.setViewportSize({ width: 1440, height: 900 });

    await frozen.getByRole('textbox', { name: /Frozen window at Plant A/ }).fill('48');
    await page.getByRole('button', { name: 'Save planning rules' }).click();
    await expect(page.getByText('Planning rules saved.')).toBeVisible();
    await checkA11y('the planning rules saved');

    await page.goto(planningRules({ preview: 'loading' }));
    await expect(page.getByText('Loading the planning rules')).toBeVisible();
    await checkA11y('the planning rules loading', { busy: true });

    await page.goto(planningRules({ preview: 'error' }));
    await expect(
      page.getByRole('heading', { level: 2, name: 'Could not load the planning rules' }),
    ).toBeVisible();
    await checkA11y('the planning rules failed');

    await page.goto(planningRules({ preview: 'forbidden' }));
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'You need the permission to change planning rules at this plant',
      }),
    ).toBeVisible();
    await checkA11y('the planning rules without access');
  });
});
