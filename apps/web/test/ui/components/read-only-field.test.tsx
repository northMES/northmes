// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadOnlyField } from '../../../src/ui/components/read-only-field/index.ts';

afterEach(cleanup);

describe('ReadOnlyField (design #686 PO5, #688 MA4)', () => {
  it('names a read-only input by its label, describes it by its hint and shows the owner tag', () => {
    render(
      <ReadOnlyField
        label="Code"
        value="CNC1"
        tag="From the ERP"
        hint="The ERP's machine code identifies the machine."
      />,
    );

    const input = screen.getByLabelText('Code') as HTMLInputElement;
    expect(input.value).toBe('CNC1');
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('aria-readonly')).toBe('true');
    expect(input.getAttribute('aria-describedby')).not.toBeNull();
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      "The ERP's machine code identifies the machine.",
    );
    expect(screen.getByText('From the ERP')).toBeTruthy();
  });
});
