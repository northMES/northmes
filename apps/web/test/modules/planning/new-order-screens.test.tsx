// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEnteredOrdersStore,
  type EnteredOrdersStore,
} from '../../../src/modules/planning/entered-orders-store.ts';
import { plant, renderPlanningAt } from './gantt-fixtures.tsx';

afterEach(cleanup);

function renderAt(href: string, entered: EnteredOrdersStore = createEnteredOrdersStore()) {
  const router = renderPlanningAt(href, undefined, undefined, undefined, entered);
  return { router, entered };
}

function field(name: string | RegExp): HTMLInputElement {
  return screen.getByRole('textbox', { name }) as HTMLInputElement;
}

function choice(name: string | RegExp): HTMLSelectElement {
  return screen.getByRole('combobox', { name }) as HTMLSelectElement;
}

describe('New production order (#768, NO1 to NO9)', () => {
  it('NO3 New production order on the list opens the form, and Create order adds N-1007 to the plan', async () => {
    const { router, entered } = renderAt(planningLinks.orders({ plant }).href);
    await userEvent.click(await screen.findByRole('link', { name: 'New production order' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New production order' }),
    ).toBeTruthy();
    expect(field('Number').value).toBe('N-1007');

    await userEvent.selectOptions(choice('Article'), 'Gear blank 32');
    await userEvent.type(field(/^Quantity/), '400');
    await userEvent.type(field(/^Deadline date/), '2026-11-27');
    const operations = screen.getByRole('table', { name: 'Operations' });
    expect(within(operations).getByText('N-1007.10')).toBeTruthy();
    expect(within(operations).getByText('N-1007.20')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Order N-1007' })).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      planningLinks.orders.order({ plant, orderId: 'po-N-1007' }).href,
    );
    expect(entered.get().productionOrders[0]).toMatchObject({
      number: 'N-1007',
      article: 'Gear blank 32',
      quantity: 400,
      deadlineDate: '2026-11-27',
      suppliedLines: [],
    });
  });

  it('NO1 from a customer order line, the form takes its article, quantity and wanted date and supplies it', async () => {
    const { entered } = renderAt(planningLinks.orders.new({ plant }, { line: '40211-2' }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });

    expect(choice('Article').value).toBe('Hub 12');
    expect(field(/^Quantity/).value).toBe('250');
    expect(field(/^Deadline date/).value).toBe('2026-11-20');
    const supplies = screen.getByRole('table', { name: 'Supplies' });
    expect(within(supplies).getByText('40211 line 2')).toBeTruthy();
    expect(screen.getByText('250 of 250 pcs go to customers, 0 pcs to stock.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Create order' }));
    await screen.findByRole('heading', { level: 1, name: 'Order N-1007' });
    expect(entered.get().productionOrders[0]?.suppliedLines).toEqual(['40211-2']);
  });

  it('NO5 the operations and the supplies scroll sideways in a region the keyboard reaches (WCAG 2.1.1)', async () => {
    renderAt(planningLinks.orders.new({ plant }, { line: '40211-2' }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });

    for (const name of ['Operations, scrolls sideways', 'Supplies, scrolls sideways']) {
      const region = screen.getByRole('region', { name });
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(within(region).getByRole('table')).toBeTruthy();
    }
  });

  it('NO4 a taken number, no quantity and a date that does not parse are refused with the error summary', async () => {
    const { entered } = renderAt(planningLinks.orders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });

    await userEvent.clear(field('Number'));
    await userEvent.type(field('Number'), '1004');
    await userEvent.selectOptions(choice('Article'), 'Hub 12');
    await userEvent.type(field(/^Deadline date/), '27.11.2026');
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }));

    const summary = await screen.findByRole('group', { name: '3 fields need a change' });
    expect(within(summary).getByRole('link', { name: /Number 1004 is in use/ })).toBeTruthy();
    expect(field(/^Quantity/).getAttribute('aria-invalid')).toBe('true');
    expect(field(/^Deadline date/).getAttribute('aria-invalid')).toBe('true');
    expect(entered.get().productionOrders).toEqual([]);
  });

  it('NO1 Add a line takes an unsupplied line of the article, and more than the order makes is refused', async () => {
    renderAt(planningLinks.orders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });
    await userEvent.selectOptions(choice('Article'), 'Hub 12');
    await userEvent.type(field(/^Quantity/), '200');
    await userEvent.type(field(/^Deadline date/), '2026-11-20');

    await userEvent.selectOptions(choice('Customer order line'), '40211-2');
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(
      within(screen.getByRole('table', { name: 'Supplies' })).getByText('40211 line 2'),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }));

    const summary = await screen.findByRole('group', { name: '1 field needs a change' });
    expect(
      within(summary).getByText(/The lines ask for 250 pcs, more than the order's 200 pcs/),
    ).toBeTruthy();
  });

  it('NO1 a line that another order supplies, or that does not exist, is not taken over', async () => {
    renderAt(planningLinks.orders.new({ plant }, { line: '40211-1' }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });

    expect(screen.getByText('Started from the production orders list')).toBeTruthy();
    expect(choice('Article').value).toBe('');
    expect(screen.queryByRole('table', { name: 'Supplies' })).toBeNull();
  });

  it('NO4 a quantity in whole pieces only: 1,000 and 2.5 are refused', async () => {
    renderAt(planningLinks.orders.new({ plant }, { line: '40211-2' }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });
    const quantity = field(/^Quantity/);

    for (const typed of ['1,000', '2.5']) {
      await userEvent.clear(quantity);
      await userEvent.type(quantity, typed);
      await userEvent.click(screen.getByRole('button', { name: 'Create order' }));
      expect(await screen.findByRole('group', { name: '1 field needs a change' })).toBeTruthy();
      expect(quantity.getAttribute('aria-invalid')).toBe('true');
    }
  });

  it('NO8 a save that fails keeps the entries and names the correlation id', async () => {
    const { entered } = renderAt(
      planningLinks.orders.new({ plant }, { line: '40211-2', preview: 'saveError' }).href,
    );
    await screen.findByRole('heading', { level: 1, name: 'New production order' });
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }));

    const summary = await screen.findByRole('group', { name: 'Could not create the order' });
    expect(summary.textContent).toContain('Correlation id');
    expect(field(/^Quantity/).value).toBe('250');
    expect(entered.get().productionOrders).toEqual([]);
  });

  it('NO1 Create order takes the place of the form in the history and says the order was created', async () => {
    const { router } = renderAt(planningLinks.orders.new({ plant }, { line: '40211-2' }).href);
    await screen.findByRole('heading', { level: 1, name: 'New production order' });
    const before = router.history.length;
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }));
    await screen.findByRole('heading', { level: 1, name: 'Order N-1007' });

    expect(router.history.length).toBe(before);
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(
        'Order N-1007 created.',
      ),
    );
  });

  it('NO6, NO7 and NO9 the preview key opens the loading, no article and no-access states', async () => {
    renderAt(planningLinks.orders.new({ plant }, { preview: 'loading' }).href);
    expect(await screen.findByText('Loading articles and customer order lines')).toBeTruthy();
    cleanup();

    renderAt(planningLinks.orders.new({ plant }, { preview: 'empty' }).href);
    expect(await screen.findByText('No article can be ordered yet')).toBeTruthy();
    cleanup();

    renderAt(planningLinks.orders.new({ plant }, { preview: 'error' }).href);
    expect(await screen.findByText('Could not load the form')).toBeTruthy();
    cleanup();

    renderAt(planningLinks.orders.new({ plant }, { preview: 'forbidden' }).href);
    expect(
      await screen.findByText('You need the permission to create production orders at this plant'),
    ).toBeTruthy();
  });
});

describe('New customer order (#768, NC1 to NC7)', () => {
  it('NC1 New customer order on the list opens the form, and Create customer order adds its lines and their supply', async () => {
    const { router, entered } = renderAt(planningLinks.customerOrders({ plant }).href);
    await userEvent.click(await screen.findByRole('link', { name: 'New customer order' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New customer order' }),
    ).toBeTruthy();
    expect(field('Number').value).toBe('40224');

    await userEvent.selectOptions(choice('Customer'), 'K-1211');
    await userEvent.type(field(/^Customer's reference/), 'LM-2026-140');
    await userEvent.selectOptions(choice('Article of line 1'), 'Hub 12');
    await userEvent.type(field('Quantity of line 1, pcs'), '100');
    await userEvent.type(field('Wanted date of line 1'), '2026-11-27');
    await userEvent.selectOptions(choice('Supply of line 1'), '1004');
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.selectOptions(choice('Article of line 2'), 'Shaft 8');
    await userEvent.type(field('Quantity of line 2, pcs'), '200');
    await userEvent.type(field('Wanted date of line 2'), '2026-11-25');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer order' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Customer order 40224' }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe(
      planningLinks.customerOrders.customerOrder({ plant, customerOrderId: '40224' }).href,
    );
    expect(entered.get().customerOrders[0]).toMatchObject({
      number: '40224',
      customerCode: 'K-1211',
      customersReference: 'LM-2026-140',
      lines: [
        { line: 1, article: 'Hub 12', quantity: 100, wantedDate: '2026-11-27', supply: '1004' },
        { line: 2, article: 'Shaft 8', quantity: 200, wantedDate: '2026-11-25', supply: null },
      ],
    });
  });

  it('NC1 a line supplied by a new production order opens New production order with that line after creating', async () => {
    const { router } = renderAt(planningLinks.customerOrders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New customer order' });
    await userEvent.selectOptions(choice('Customer'), 'K-1211');
    await userEvent.selectOptions(choice('Article of line 1'), 'Gear blank 32');
    await userEvent.type(field('Quantity of line 1, pcs'), '400');
    await userEvent.type(field('Wanted date of line 1'), '2026-11-27');
    const supply = choice('Supply of line 1');
    // Order 1003 supplies 40208 line 1 in full, so it has nothing free for this line.
    expect(within(supply).queryByRole('option', { name: /Order 1003/ })).toBeNull();
    await userEvent.selectOptions(supply, 'new');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer order' }));

    await screen.findByRole('heading', { level: 1, name: 'New production order' });
    expect(router.state.location.search).toMatchObject({ line: '40224-1' });
    expect(choice('Article').value).toBe('Gear blank 32');
  });

  it('NC1 a taken number, no customer and a line without a quantity are refused', async () => {
    const { entered } = renderAt(planningLinks.customerOrders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New customer order' });
    await userEvent.clear(field('Number'));
    await userEvent.type(field('Number'), '40211');
    await userEvent.selectOptions(choice('Article of line 1'), 'Hub 12');
    await userEvent.type(field('Wanted date of line 1'), '2026-11-27');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer order' }));

    const summary = await screen.findByRole('group', { name: '3 fields need a change' });
    expect(within(summary).getByRole('link', { name: /Customer order 40211 exists/ })).toBeTruthy();
    expect(entered.get().customerOrders).toEqual([]);
  });

  it('NC1 a supply that no longer has the quantity free goes back to Not supplied, and two lines cannot share more than an order has free', async () => {
    renderAt(planningLinks.customerOrders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New customer order' });
    await userEvent.selectOptions(choice('Article of line 1'), 'Hub 12');
    await userEvent.type(field('Quantity of line 1, pcs'), '1000');
    await userEvent.selectOptions(choice('Supply of line 1'), '1004');

    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.selectOptions(choice('Article of line 2'), 'Hub 12');
    await userEvent.type(field('Quantity of line 2, pcs'), '1000');
    // Line 1 takes 1 000 of the 1 200 pcs 1004 has free, so 200 are left for line 2.
    expect(
      within(choice('Supply of line 2')).queryByRole('option', { name: /Order 1004/ }),
    ).toBeNull();

    await userEvent.clear(field('Quantity of line 1, pcs'));
    await userEvent.type(field('Quantity of line 1, pcs'), '1500');
    expect(choice('Supply of line 1').value).toBe('');
  });

  it('NC1 only one line opens New production order after creating, and a number must suit an address', async () => {
    const { entered } = renderAt(planningLinks.customerOrders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New customer order' });
    await userEvent.clear(field('Number'));
    await userEvent.type(field('Number'), 'new');
    await userEvent.selectOptions(choice('Customer'), 'K-1211');
    for (const n of [1, 2]) {
      if (n === 2) await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
      await userEvent.selectOptions(choice(`Article of line ${n}`), 'Gear blank 32');
      await userEvent.type(field(`Quantity of line ${n}, pcs`), '100');
      await userEvent.type(field(`Wanted date of line ${n}`), '2026-11-27');
      await userEvent.selectOptions(choice(`Supply of line ${n}`), 'new');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Create customer order' }));

    const summary = await screen.findByRole('group', { name: '2 fields need a change' });
    expect(within(summary).getByText(/new is a word the address takes/)).toBeTruthy();
    expect(within(summary).getByText(/Only one line can open New production order/)).toBeTruthy();
    expect(entered.get().customerOrders).toEqual([]);
  });

  it('NC1 an error stays with its line when a line above it is removed', async () => {
    renderAt(planningLinks.customerOrders.new({ plant }).href);
    await screen.findByRole('heading', { level: 1, name: 'New customer order' });
    await userEvent.selectOptions(choice('Customer'), 'K-1211');
    await userEvent.selectOptions(choice('Article of line 1'), 'Hub 12');
    await userEvent.type(field('Wanted date of line 1'), '2026-11-27');
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.selectOptions(choice('Article of line 2'), 'Shaft 8');
    await userEvent.type(field('Quantity of line 2, pcs'), '200');
    await userEvent.type(field('Wanted date of line 2'), '2026-11-25');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer order' }));
    expect(field('Quantity of line 1, pcs').getAttribute('aria-invalid')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(field('Quantity of line 1, pcs').value).toBe('200');
    expect(field('Quantity of line 1, pcs').getAttribute('aria-invalid')).toBeNull();
  });

  it('NC6 a save that fails keeps the entries and names the correlation id', async () => {
    const { entered } = renderAt(
      planningLinks.customerOrders.new({ plant }, { preview: 'saveError' }).href,
    );
    await screen.findByRole('heading', { level: 1, name: 'New customer order' });
    await userEvent.selectOptions(choice('Customer'), 'K-1211');
    await userEvent.selectOptions(choice('Article of line 1'), 'Shaft 8');
    await userEvent.type(field('Quantity of line 1, pcs'), '200');
    await userEvent.type(field('Wanted date of line 1'), '2026-11-25');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer order' }));

    const summary = await screen.findByRole('group', {
      name: 'Could not create the customer order',
    });
    expect(summary.textContent).toContain('Correlation id');
    expect(field('Quantity of line 1, pcs').value).toBe('200');
    expect(entered.get().customerOrders).toEqual([]);
  });

  it('NC4, NC5 and NC7 the preview key opens the loading, no customers and no-access states', async () => {
    renderAt(planningLinks.customerOrders.new({ plant }, { preview: 'loading' }).href);
    expect(await screen.findByText('Loading customers and articles')).toBeTruthy();
    cleanup();

    renderAt(planningLinks.customerOrders.new({ plant }, { preview: 'empty' }).href);
    expect(await screen.findByText('No customers yet')).toBeTruthy();
    cleanup();

    renderAt(planningLinks.customerOrders.new({ plant }, { preview: 'error' }).href);
    expect(await screen.findByText('Could not load the form')).toBeTruthy();
    cleanup();

    renderAt(planningLinks.customerOrders.new({ plant }, { preview: 'forbidden' }).href);
    await waitFor(() =>
      expect(screen.getByText('You need the permission to create customer orders')).toBeTruthy(),
    );
  });
});
