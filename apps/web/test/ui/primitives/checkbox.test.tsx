// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../../../src/ui/primitives/checkbox.tsx';

afterEach(cleanup);

describe('Checkbox', () => {
  it('E04-S01 a checkbox is named by its label, toggles on Space and on a click of the label, and keeps focus', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Show archived" checked={false} onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Show archived' });

    await user.tab();
    expect(document.activeElement).toBe(checkbox);
    await user.keyboard(' ');
    await user.click(screen.getByText('Show archived'));

    expect(onCheckedChange.mock.calls).toEqual([[true], [true]]);
    expect(document.activeElement).toBe(checkbox);
  });

  it('E04-S01 a checked checkbox reports checked and asks to be unchecked', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Show archived" checked onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Show archived' }) as HTMLInputElement;

    expect(checkbox.checked).toBe(true);
    await user.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
