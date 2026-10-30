// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { findGantt, renderGanttRoute } from './gantt-fixtures.tsx';

afterEach(cleanup);

/** The row with this id. */
function rowOf(gantt: HTMLElement, id: string): HTMLElement {
  const row = gantt.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (row === null) throw new Error(`No row ${id}`);
  return row;
}

/** The element the focused element's aria-describedby points at, or null. */
function descriptionOfFocused(): HTMLElement | null {
  const id = document.activeElement?.getAttribute('aria-describedby');
  return id === null || id === undefined ? null : document.getElementById(id);
}

/** The text of an element that assistive technology reads: every text outside aria-hidden. */
function spokenTexts(element: Element): string[] {
  if (element.getAttribute('aria-hidden') === 'true') return [];
  return Array.from(element.childNodes).flatMap((node) =>
    node.nodeType === Node.TEXT_NODE
      ? [node.textContent ?? ''].filter((text) => text.trim() !== '')
      : node instanceof Element
        ? spokenTexts(node)
        : [],
  );
}

describe('what the order Gantt tells a screen reader (#902, ADR 0021)', () => {
  it('#902 a focused block is described by its hover card fields and analysis lines, not its name', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1006-10"]');
    expect(block?.hasAttribute('aria-describedby')).toBe(false);

    rowOf(gantt, 'jo-1006-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(block);

    const description = descriptionOfFocused();
    expect(description).not.toBeNull();
    const text = description?.textContent ?? '';
    expect(text).toContain('3 h working');
    expect(text).toContain('66 h elapsed');
    expect(text).toContain('4 hold');
    expect(text).not.toContain('1006.10 Mill');
    // The card shows the same fields.
    const card = await screen.findByRole('tooltip');
    expect(within(card).getByText('66 h elapsed')).toBeTruthy();
  });

  it('#902 keeps the description of a focused block after Escape closes its hover card', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();

    rowOf(gantt, 'jo-1006-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByRole('tooltip')).toBeTruthy();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(document.activeElement?.getAttribute('data-block')).toBe('jo-1006-10');
    expect(descriptionOfFocused()?.textContent).toContain('4 hold');
  });

  it('#902 keeps the description of a block that a click focused and selected, which closes its hover card', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1006-10"]');
    if (block === null) throw new Error('No block jo-1006-10');

    await userEvent.click(block);

    await waitFor(() => expect(block.getAttribute('data-selected')).toBe('true'));
    expect(document.activeElement).toBe(block);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(descriptionOfFocused()?.textContent).toContain('66 h elapsed');
  });

  it('#902 drops the description when focus leaves the block, so only the focused block holds one', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const block = gantt.querySelector<HTMLElement>('[data-block="jo-1006-10"]');

    rowOf(gantt, 'jo-1006-10').focus();
    await userEvent.keyboard('{ArrowRight}');
    const id = block?.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    await userEvent.keyboard('{ArrowLeft}');

    expect(document.activeElement).toBe(rowOf(gantt, 'jo-1006-10'));
    expect(block?.hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById(id ?? '')).toBeNull();
  });

  it('#902 names each time header cell by its full date, while the cell shows the label that fits', async () => {
    renderGanttRoute({ zoom: 'week', from: '2026-11-02' });
    const gantt = await findGantt();
    const header = within(gantt).getByRole('columnheader', { name: 'Time' });

    const spoken = spokenTexts(header);
    expect(spoken).toContain('Mon 2 Nov');
    expect(spoken).toContain('Mon 2 Nov 12:00');
    expect(spoken).toContain('Tue 3 Nov 06:00');
    // The short labels are drawn for sight alone.
    const shown = Array.from(header.querySelectorAll('[data-tier="bottom"]')).map(
      (cell) => cell.querySelector('[data-tick-label]')?.textContent,
    );
    expect(shown).toContain('12:00');
    expect(spoken).not.toContain('12:00');
  });
});
