// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createG1PlanningRulesStore,
  createPlanningRulesStore,
  type PlanningRulesStore,
} from '../../../src/modules/planning/planning-rules-store.ts';
import { plant, renderPlanningAt } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** Renders the planning rules page of Plant A, with a page state the URL previews. */
function renderRules(rules: PlanningRulesStore = createG1PlanningRulesStore(), preview?: string) {
  const href = planningLinks.settings.rules({ plant }).href;
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

/** The saved message the form shows, apart from the announcer's copy of it. */
function savedText(): HTMLElement {
  return screen.getByText('Planning rules saved.', { selector: 'form p' });
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

  it('PS1 a saved frozen window of 48 h goes to the store, the page says what it does on the Gantt, and the app announces the save', async () => {
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
    await waitFor(() =>
      expect(document.getElementById('announcer-polite')?.textContent).toBe(
        'Planning rules saved.',
      ),
    );
    // The page shows the message too, as text: the announcer is the one live region (#766).
    expect(savedText().getAttribute('role')).toBeNull();
  });

  it('PS4 a planning factor set for the plant stays stored while the plant divides run time by something else', async () => {
    const rules = createPlanningRulesStore({
      company: createG1PlanningRulesStore().get().company,
      plants: { [plant]: { planningFactorSource: 'none', planningFactor: 1.2, frozenHours: 24 } },
    });
    renderRules(rules);
    const factor = await findRule('Planning factor');
    expect(
      within(factor).getByText(/^Not used: Plant A divides run time by nothing\./),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));

    await waitFor(() => expect(savedText()).toBeTruthy());
    expect(rules.get().plants[plant]?.planningFactor).toBe(1.2);
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

  it('PS4 a frozen window above 720 h and a lock expiry above 24 h are refused', async () => {
    const rules = renderRules();
    const frozen = await findRule('Frozen window');
    const input = within(frozen).getByRole('textbox', { name: /Frozen window at Plant A/ });
    await userEvent.clear(input);
    await userEvent.type(input, '100000000');
    const lock = await findRule('Lock expiry after idle time');
    await userEvent.click(within(lock).getByRole('radio', { name: 'Set for Plant A' }));
    const minutes = within(lock).getByRole('textbox', {
      name: /Lock expiry after idle time at Plant A/,
    });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, '1441');
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));

    expect(await screen.findByRole('group', { name: '2 rules need a change' })).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(minutes.getAttribute('aria-invalid')).toBe('true');
    expect(rules.get().plants[plant]?.frozenHours).toBe(24);
  });

  it('PS4 a choice without a value at either scope asks for one and is refused until it has one', async () => {
    const rules = createPlanningRulesStore({
      company: { planningFactorSource: 'none', frozenHours: 24, softLockIdleExpiry: 1800 },
      plants: {},
    });
    renderRules(rules);
    const card = await findRule('Purchase requisitions count as incoming stock');
    const select = within(card).getByRole('combobox', {
      name: /Purchase requisitions count as incoming stock at Plant A/,
    }) as HTMLSelectElement;
    expect(select.value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));
    expect(await screen.findByRole('group', { name: '1 rule needs a change' })).toBeTruthy();
    expect(select.getAttribute('aria-invalid')).toBe('true');

    await userEvent.selectOptions(select, 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));
    await waitFor(() => expect(rules.get().plants[plant]?.countPurchaseRequisitions).toBe(true));
  });

  it('PS4 a rule that only has its recorded default uses it, and a Save keeps the plant free of it (ADR 0027)', async () => {
    const rules = createPlanningRulesStore({
      company: { frozenHours: 24, softLockIdleExpiry: 1800, countPurchaseRequisitions: false },
      plants: {},
    });
    renderRules(rules);
    const deadline = await findRule('Deadline time when the ERP sends a date only');
    expect(checked(deadline, 'Use the default, Start of day, 00:00')).toBe(true);
    expect(within(deadline).getByText('No value', { selector: 'b' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));
    await waitFor(() => expect(savedText()).toBeTruthy());
    expect(rules.get().plants[plant]?.deadlineRule).toBeUndefined();
  });

  it('PS4 the error summary drops a rule that no longer applies, and a reason counts as a change that Save clears', async () => {
    renderRules();
    const source = await findRule('What divides run time');
    const sourceSelect = within(source).getByRole('combobox', {
      name: /What divides run time at Plant A/,
    });
    await userEvent.selectOptions(sourceSelect, 'factor');
    const factor = await findRule('Planning factor');
    await userEvent.type(
      within(factor).getByRole('textbox', { name: /Planning factor at Plant A/ }),
      '2.5',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));
    expect(await screen.findByRole('group', { name: '1 rule needs a change' })).toBeTruthy();

    await userEvent.selectOptions(sourceSelect, 'none');
    expect(screen.queryByRole('group', { name: /needs? a change$/ })).toBeNull();

    const reason = screen.getByRole('textbox', { name: /Reason/ }) as HTMLTextAreaElement;
    await userEvent.type(reason, 'Pilot week');
    expect(screen.getByText('Changes not saved')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Save planning rules' }));
    await waitFor(() => expect(savedText()).toBeTruthy());
    expect(reason.value).toBe('');
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
