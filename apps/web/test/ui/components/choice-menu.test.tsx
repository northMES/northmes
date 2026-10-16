// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceMenu } from '../../../src/ui/components/choice-menu/index.ts';

afterEach(cleanup);

const keys = [
  { value: undefined, label: 'No grouping' },
  { value: 'articleGroup', label: 'Article group' },
  { value: 'stockUnit', label: 'Stock unit' },
];

describe('ChoiceMenu', () => {
  it('E06-S03 a choice menu is named by its label and its choice, and a radio item hands back the chosen value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChoiceMenu label="Group by" choices={keys} value="articleGroup" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Group by: Article group' }));
    const radios = await screen.findAllByRole('menuitemradio');
    expect(radios.map((radio) => [radio.textContent, radio.getAttribute('aria-checked')])).toEqual([
      ['No grouping', 'false'],
      ['Article group', 'true'],
      ['Stock unit', 'false'],
    ]);
    await user.click(screen.getByRole('menuitemradio', { name: 'No grouping' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('E06-S03 without a choice the menu is named by its label', () => {
    render(<ChoiceMenu label="Group by" choices={keys} value={undefined} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Group by' })).toBeDefined();
  });
});
