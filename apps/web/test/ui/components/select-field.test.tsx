// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectField } from '../../../src/ui/components/select-field/index.ts';

afterEach(cleanup);

const units = [
  { value: 'PIECE', label: 'Pieces (pcs)' },
  { value: 'METRE', label: 'Metres (m)' },
];

describe('SelectField', () => {
  it('E04-S07 a select field is named by its label, described by its hint, and starts on its placeholder', async () => {
    const user = userEvent.setup();
    render(
      <SelectField
        label="Stock unit"
        hint="Quantities of this article are counted in this unit."
        placeholder="Choose a unit"
        options={units}
        name="stockUnit"
        defaultValue=""
      />,
    );

    const select = screen.getByRole('combobox', {
      name: 'Stock unit',
      description: 'Quantities of this article are counted in this unit.',
    }) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByRole('option', { name: 'Choose a unit' })).toBeDefined();

    await user.selectOptions(select, 'Metres (m)');

    expect(select.value).toBe('METRE');
  });

  it('E04-S07 an invalid select field says why, before its hint', () => {
    render(
      <SelectField
        label="Stock unit"
        hint="Quantities of this article are counted in this unit."
        error="Choose a stock unit."
        options={units}
        name="stockUnit"
      />,
    );

    const select = screen.getByRole('combobox', {
      name: 'Stock unit',
      description: 'Choose a stock unit. Quantities of this article are counted in this unit.',
    });
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('E04-S07 an optional select field says so in its name', () => {
    render(<SelectField label="Article group" optional options={units} name="group" />);

    expect(screen.getByRole('combobox', { name: 'Article group (optional)' })).toBeDefined();
  });
});
