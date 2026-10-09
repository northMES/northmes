// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextField } from '../../../src/ui/components/text-field/index.ts';

afterEach(cleanup);

describe('TextField', () => {
  it('E04-S01 a text field is named by its label, described by its hint, and takes typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TextField
        label="Name"
        hint="In Swedish, the data language of Acme AB."
        name="name"
        onChange={onChange}
      />,
    );

    const input = screen.getByRole('textbox', {
      name: 'Name',
      description: 'In Swedish, the data language of Acme AB.',
    });
    await user.click(screen.getByText('Name'));
    await user.keyboard('Fläns');

    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Fläns');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('E04-S01 an optional text field says so in its name', () => {
    render(<TextField label="Note" optional name="note" />);

    expect(screen.getByRole('textbox', { name: 'Note (optional)' })).toBeDefined();
  });

  it('E04-S01 a text field with an error is invalid and is described by the error, then the hint', () => {
    render(
      <TextField
        label="Name"
        hint="In Swedish, the data language of Acme AB."
        error="Enter a name."
        name="name"
      />,
    );

    const input = screen.getByRole('textbox', {
      name: 'Name',
      description: 'Enter a name. In Swedish, the data language of Acme AB.',
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
