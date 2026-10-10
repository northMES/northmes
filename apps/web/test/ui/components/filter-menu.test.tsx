// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterMenu } from '../../../src/ui/components/filter-menu/index.ts';

afterEach(cleanup);

const groups = [
  { value: 'co', label: 'Consumables', count: 12 },
  { value: 'ho', label: 'Hoses', count: 21 },
  { value: 'sh', label: 'Shafts', count: 40 },
];

describe('FilterMenu', () => {
  it('E06-S03 a filter menu button is named by its label, then how many values are picked', () => {
    render(
      <FilterMenu
        label="Article group"
        heading="Show articles in these groups"
        options={groups}
        selected={['ho', 'sh']}
        onChange={() => {}}
      />,
    );

    const button = screen.getByRole('button', { name: 'Article group, 2 selected' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
  });

  it("E06-S03 the menu lists every value with its count, checked when it is picked, and a click hands back the picks with that value's turned", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterMenu
        label="Article group"
        heading="Show articles in these groups"
        options={groups}
        selected={['ho']}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Article group, 1 selected' }));
    const items = await screen.findAllByRole('menuitemcheckbox');
    expect(items.map((item) => [item.textContent, item.getAttribute('aria-checked')])).toEqual([
      ['Consumables 12', 'false'],
      ['Hoses 21', 'true'],
      ['Shafts 40', 'false'],
    ]);
    expect(screen.getByText('Show articles in these groups')).toBeDefined();
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Shafts 40' }));

    expect(onChange).toHaveBeenCalledWith(['ho', 'sh']);
  });

  it('E06-S03 a filter menu without picks is named by its label alone', () => {
    render(
      <FilterMenu
        label="Source"
        heading="Show articles from"
        options={[]}
        selected={[]}
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Source' })).toBeDefined();
  });
});
