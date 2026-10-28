// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '../../../src/ui/primitives/checkbox.tsx';

afterEach(cleanup);

// The D1 look and the two-tone focus ring are read from computed style in e2e/design-rules.spec.ts.
describe('Checkbox', () => {
  it('E04-S01 a checkbox is named by its label, starts unchecked and toggles its checked state on a click', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Show archived" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Show archived' });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    await user.click(checkbox);

    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });
});
