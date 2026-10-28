// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormActions } from '../../../src/ui/components/form-actions/index.ts';

afterEach(cleanup);

describe('FormActions', () => {
  it('#762 resets in place with a Cancel button when the form stays on its page', async () => {
    const onCancel = vi.fn();
    render(
      <form>
        <FormActions
          saveLabel="Save board fields"
          saving={false}
          onCancel={onCancel}
          dirty
          note="Nothing moves on the plan."
        />
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Save board fields' }).getAttribute('type')).toBe(
      'submit',
    );
    expect(screen.getByText('Changes not saved')).toBeTruthy();
    expect(screen.getByText('Nothing moves on the plan.')).toBeTruthy();
  });
});
