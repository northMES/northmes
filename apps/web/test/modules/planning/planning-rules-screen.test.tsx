// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createG1PlanningRulesStore,
  type PlanningRulesStore,
} from '../../../src/modules/planning/planning-rules-store.ts';
import { plant, renderPlanningAt } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** Renders the planning rules page of Plant A, with a page state the URL previews. */
function renderRules(rules: PlanningRulesStore = createG1PlanningRulesStore(), preview?: string) {
  const href = planningLinks.settings({ plant }).href;
  renderPlanningAt(
    preview === undefined ? href : `${href}?preview=${preview}`,
    undefined,
    undefined,
    rules,
  );
  return rules;
}

/** The card of one rule, named by its h2. */
async function findRule(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name });
}

function checked(rule: HTMLElement, name: string | RegExp): boolean {
  return within(rule).getByRole('radio', { name }).getAttribute('aria-checked') === 'true';
}

describe('the planning rules page in plant settings (plan 07, Settings; #766, PS1 to PS7)', () => {
  it("PS1 lists the eight rules with the company value, Plant A's choice, the default and the ADR that records it", async () => {
    renderRules();
    expect(await screen.findByRole('heading', { level: 1, name: 'Planning rules' })).toBeTruthy();

    const names = [
      'What divides run time',
      'Planning factor',
      'Frozen window',
      'Lead time counts',
      'Setup may run during the lead time',
      'Deadline time when the ERP sends a date only',
      'Lock expiry after idle time',
      'Purchase requisitions count as incoming stock',
    ];
    for (const name of names) expect(await findRule(name)).toBeTruthy();

    const frozen = await findRule('Frozen window');
    expect(within(frozen).getByText('frozenHours')).toBeTruthy();
    expect(
      within(frozen).getByText(/None recorded; a plant needs a value before it opens/),
    ).toBeTruthy();
    expect(within(frozen).getByRole('link', { name: 'ADR 0028' })).toBeTruthy();
    expect(within(frozen).getByText('Open with the product owner')).toBeTruthy();
    expect(checked(frozen, 'Set for Plant A')).toBe(true);
    expect(
      within(frozen)
        .getByRole('radio', { name: 'Use the company value, none is set' })
        .hasAttribute('data-disabled'),
    ).toBe(true);
    expect(
      (
        within(frozen).getByRole('textbox', {
          name: /Frozen window at Plant A/,
        }) as HTMLInputElement
      ).value,
    ).toBe('24');
    expect(
      within(frozen).getByText(
        'On the Gantt the frozen window runs from now, Mon 2 Nov 09:40, to Tue 3 Nov 09:40.',
      ),
    ).toBeTruthy();

    const lead = await findRule('Lead time counts');
    expect(checked(lead, 'Use the company value')).toBe(true);
    expect(within(lead).getByText('Elapsed time', { selector: 'b' })).toBeTruthy();

    const overlap = await findRule('Setup may run during the lead time');
    expect(within(overlap).getByText('Proposed')).toBeTruthy();

    const factor = await findRule('Planning factor');
    expect(
      within(factor).getByText(/Not used: Plant A divides run time by nothing\./),
    ).toBeTruthy();
  });

  it('PS1 a saved frozen window of 48 h goes to the store, and the page says what it does on the Gantt', async () => {
    const rules = renderRules();
    const frozen = await findRule('Frozen window');
    const input = within(frozen).getByRole('textbox', { name: /Frozen window at Plant A/ });

    await userEvent.clear(input);
    await userEvent.type(input, '48');
    expect(
      within(frozen).getByText(
        'On the Gantt the frozen window runs from now, Mon 2 Nov 09:40, to Wed 4 Nov 09:40.',
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));

    await waitFor(() => expect(rules.get().plants[plant]?.frozenHours).toBe(48));
    expect(screen.getByText('Planning rules saved.')).toBeTruthy();
  });

  it("PS1 Use the company value for the deadline rule takes Plant A's own value away on Save", async () => {
    const rules = renderRules();
    const deadline = await findRule('Deadline time when the ERP sends a date only');
    expect(checked(deadline, 'Set for Plant A')).toBe(true);

    await userEvent.click(within(deadline).getByRole('radio', { name: 'Use the company value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));

    await waitFor(() => expect(rules.get().plants[plant]?.deadlineRule).toBeUndefined());
    expect(rules.get().plants[plant]?.frozenHours).toBe(24);
  });

  it('PS4 a rule without a value is refused with the error summary, and one factor for the plant asks for the factor', async () => {
    const rules = renderRules();
    const frozen = await findRule('Frozen window');
    await userEvent.clear(
      within(frozen).getByRole('textbox', { name: /Frozen window at Plant A/ }),
    );

    const source = await findRule('What divides run time');
    await userEvent.selectOptions(
      within(source).getByRole('combobox', { name: /What divides run time at Plant A/ }),
      'factor',
    );
    const factor = await findRule('Planning factor');
    const factorInput = within(factor).getByRole('textbox', { name: /Planning factor at Plant A/ });
    await userEvent.type(factorInput, '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));

    const summary = await screen.findByRole('group', { name: '2 rules need a change' });
    expect(within(summary).getByRole('link', { name: /Frozen window/ })).toBeTruthy();
    expect(within(summary).getByRole('link', { name: /Planning factor/ })).toBeTruthy();
    expect(factorInput.getAttribute('aria-invalid')).toBe('true');
    expect(rules.get().plants[plant]?.frozenHours).toBe(24);
  });

  it('PS5 to PS7 the preview key opens the loading, failed and no-access states', async () => {
    renderRules(undefined, 'loading');
    expect(await screen.findByText('Loading the planning rules')).toBeTruthy();
    cleanup();

    renderRules(undefined, 'error');
    expect(await screen.findByText('Could not load the planning rules')).toBeTruthy();
    cleanup();

    renderRules(undefined, 'forbidden');
    expect(
      await screen.findByText('You need the permission to change planning rules at this plant'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save planning rules' })).toBeNull();
  });
});
