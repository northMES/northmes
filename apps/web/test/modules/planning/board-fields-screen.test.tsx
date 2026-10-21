// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type BoardFieldsStore,
  createG1BoardFieldsStore,
} from '../../../src/modules/planning/board-fields-store.ts';
import { findGantt, plant, renderPlanningAt } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** Renders the board fields page of Plant A, with a page state the URL previews. */
function renderBoardFields(store: BoardFieldsStore = createG1BoardFieldsStore(), preview?: string) {
  const href = planningLinks.settings.boardFields({ plant }).href;
  const router = renderPlanningAt(
    preview === undefined ? href : `${href}?preview=${preview}`,
    undefined,
    store,
  );
  return { router, store };
}

/** The card of one list, named by its h2. */
async function findList(name: 'Block fields' | 'Hover fields'): Promise<HTMLElement> {
  return screen.findByRole('region', { name });
}

/** The field names of a list's editor, in order. */
function fieldNames(list: HTMLElement): string[] {
  const editor = within(list).getByRole('list');
  return within(editor)
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('data-field-label') ?? '');
}

describe('the board fields page in plant settings (plan 07, Board settings; #762)', () => {
  it('#762 shows both lists with the company value, which Plant A uses until it sets its own', async () => {
    renderBoardFields();

    expect(await screen.findByRole('heading', { level: 1, name: 'Board fields' })).toBeTruthy();
    const block = await findList('Block fields');
    expect(within(block).getByText('boardBlockFields')).toBeTruthy();
    expect(within(block).getByText('Article, Quantity, End', { selector: 'b' })).toBeTruthy();
    expect(
      within(block)
        .getByRole('radio', { name: 'Use the company value' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(within(block).queryByRole('list')).toBeNull();
    const hover = await findList('Hover fields');
    expect(within(hover).getByRole('radio', { name: 'Use the company value' })).toBeTruthy();
  });

  it('#762 Set for Plant A opens the list from the company value, and Move down moves a field without dragging', async () => {
    renderBoardFields();
    const hover = await findList('Hover fields');

    await userEvent.click(within(hover).getByRole('radio', { name: 'Set for Plant A' }));
    expect(fieldNames(hover).slice(0, 3)).toEqual(['Operation', 'Article', 'Quantity']);
    expect(
      (within(hover).getByRole('button', { name: 'Move Operation up' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await userEvent.click(within(hover).getByRole('button', { name: 'Move Article down' }));

    expect(fieldNames(hover).slice(0, 3)).toEqual(['Operation', 'Quantity', 'Article']);
    expect(document.activeElement).toBe(
      within(hover).getByRole('button', { name: 'Move Article down' }),
    );
    expect(within(hover).getByRole('status').textContent).toBe('Article moved to position 3 of 9.');
  });

  it('#762 Remove takes a field out and keeps focus in the list', async () => {
    renderBoardFields();
    const block = await findList('Block fields');
    await userEvent.click(within(block).getByRole('radio', { name: 'Set for Plant A' }));

    await userEvent.click(within(block).getByRole('button', { name: 'Remove Quantity' }));

    expect(fieldNames(block)).toEqual(['Article', 'End']);
    expect(document.activeElement).toBe(within(block).getByRole('button', { name: 'Remove End' }));
    expect(within(block).getByRole('status').textContent).toBe('Quantity removed. 2 of 4 fields.');
  });

  it('#762 Add hover fields offers NorthMES, ERP and module fields, marks those added and adds the chosen ones at the end', async () => {
    renderBoardFields();
    const hover = await findList('Hover fields');
    await userEvent.click(within(hover).getByRole('radio', { name: 'Set for Plant A' }));

    await userEvent.click(within(hover).getByRole('button', { name: 'Add hover fields' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add hover fields' });
    expect(within(dialog).getByRole('group', { name: 'NorthMES fields' })).toBeTruthy();
    const erp = within(dialog).getByRole('group', {
      name: 'ERP fields, found in the imported orders',
    });
    expect(within(erp).getByText('Zinc plated, in 4 of 6 orders')).toBeTruthy();
    expect(within(dialog).getByRole('group', { name: 'Module fields' })).toBeTruthy();
    const operation = within(dialog).getByRole('checkbox', { name: /^Operation/ });
    expect(operation.getAttribute('aria-checked')).toBe('true');
    expect(operation.hasAttribute('data-disabled')).toBe(true);

    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^Free float/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^PACKING/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 2 fields' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fieldNames(hover).slice(-2)).toEqual(['Free float', 'PACKING']);
  });

  it('#762 stops adding block fields at 4, so a full block never needs a third line', async () => {
    renderBoardFields();
    const block = await findList('Block fields');
    await userEvent.click(within(block).getByRole('radio', { name: 'Set for Plant A' }));
    await userEvent.click(within(block).getByRole('button', { name: 'Add block field' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add block field' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^ERP change/ }));
    expect(
      within(dialog)
        .getByRole('checkbox', { name: /^Machine/ })
        .hasAttribute('data-disabled'),
    ).toBe(true);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 1 field' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fieldNames(block)).toEqual(['Article', 'Quantity', 'End', 'ERP change']);
    expect(
      (within(block).getByRole('button', { name: 'Add block field' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(within(block).getByText('4 of 4. Remove a field to add another.')).toBeTruthy();
  });

  it('#762 Save keeps Plant A’s lists, and the Gantt draws them on its blocks', async () => {
    const { router, store } = renderBoardFields();
    const block = await findList('Block fields');
    await userEvent.click(within(block).getByRole('radio', { name: 'Set for Plant A' }));
    await userEvent.click(within(block).getByRole('button', { name: 'Remove End' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save board fields' }));

    expect(store.get().plants[plant]).toEqual({ block: ['article', 'quantity'] });
    expect(await screen.findByText('Board fields saved.')).toBeTruthy();
    await router.navigate({
      href: `${planningLinks.gantt({ plant }).href}?zoom=day&from=2026-11-03`,
    });
    const gantt = await findGantt();
    const line = gantt.querySelector('[data-block="jo-1001-10"] [data-block-line="2"]');
    expect(line?.textContent).toBe('600 pcs');
  });

  it('#762 Save keeps the page as it is, with focus on Save and the saved line shown once', async () => {
    renderBoardFields();
    const block = await findList('Block fields');
    await userEvent.click(within(block).getByRole('radio', { name: 'Set for Plant A' }));
    await userEvent.click(within(block).getByRole('button', { name: 'Remove End' }));
    await userEvent.type(screen.getByRole('textbox', { name: /^Reason/ }), 'Shorter blocks');

    const save = screen.getByRole('button', { name: 'Save board fields' });
    await userEvent.click(save);

    expect(screen.getByRole('main').textContent).toContain('Board fields saved.');
    expect(document.activeElement).toBe(save);
    expect((screen.getByRole('textbox', { name: /^Reason/ }) as HTMLTextAreaElement).value).toBe(
      'Shorter blocks',
    );
    expect(screen.queryByText('Changes not saved')).toBeNull();
  });

  it('#762 adding the field that fills the block list moves focus to its Remove button', async () => {
    renderBoardFields();
    const block = await findList('Block fields');
    await userEvent.click(within(block).getByRole('radio', { name: 'Set for Plant A' }));
    await userEvent.click(within(block).getByRole('button', { name: 'Add block field' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add block field' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^ERP change/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 1 field' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(block).getByRole('button', { name: 'Remove ERP change' }),
      ),
    );
  });

  it('#762 Use the company value again drops Plant A’s list on Save', async () => {
    const store = createG1BoardFieldsStore();
    store.save(plant, { hover: ['status'] });
    renderBoardFields(store);
    const hover = await findList('Hover fields');
    expect(fieldNames(hover)).toEqual(['Status']);

    await userEvent.click(within(hover).getByRole('radio', { name: 'Use the company value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save board fields' }));

    expect(store.get().plants[plant]).toEqual({});
  });

  it('#762 previews job order 1001.10 with the chosen fields as the board and the Gantt draw it', async () => {
    renderBoardFields();
    const preview = await screen.findByRole('region', { name: 'Preview' });

    expect(within(preview).getByText('1001.10 Bracket L')).toBeTruthy();
    expect(within(preview).getByText('600 pcs, ends Wed 4 Nov 08:00')).toBeTruthy();
    expect(within(preview).getByText('Hallberg Verkstad AB, Svea Komponent AB')).toBeTruthy();
    expect(
      within(preview).getByText('Details lists the same 9 fields in this order.'),
    ).toBeTruthy();
  });

  it('#762 shows the loading, could not load and no access states the URL previews', async () => {
    renderBoardFields(undefined, 'loading');
    expect(await screen.findByText('Loading the board fields')).toBeTruthy();
    cleanup();

    renderBoardFields(undefined, 'error');
    expect(await screen.findByText('Could not load the board fields')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    cleanup();

    renderBoardFields(undefined, 'forbidden');
    expect(
      await screen.findByText('You need the permission to change board fields at this plant'),
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Block fields' })).toBeNull();
  });

  it('#762 shows both lists empty with what blocks and the hover card then show', async () => {
    renderBoardFields(undefined, 'empty');
    const block = await findList('Block fields');
    expect(within(block).getByText('No block fields')).toBeTruthy();
    const hover = await findList('Hover fields');
    expect(within(hover).getByText('No hover fields')).toBeTruthy();
  });
});
