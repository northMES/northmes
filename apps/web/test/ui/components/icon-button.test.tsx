// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Copy } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { IconButton } from '../../../src/ui/components/icon-button/index.ts';

afterEach(cleanup);

describe('IconButton', () => {
  it('E04-S01 an icon button is named by its label, and its icon is hidden from assistive technology', () => {
    render(
      <IconButton label="Copy correlation id" variant="ghost">
        <Copy />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Copy correlation id' });
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('E04-S01 an icon button shows its label in a tooltip on keyboard focus, and Escape closes the tooltip with focus kept on the button', async () => {
    const user = userEvent.setup();
    render(
      <IconButton label="Copy correlation id" variant="ghost">
        <Copy />
      </IconButton>,
    );

    await user.tab();
    const button = screen.getByRole('button', { name: 'Copy correlation id' });
    expect(document.activeElement).toBe(button);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Copy correlation id');
    // The button keeps its aria-label as its name; the tooltip adds no description (ui-222).
    expect(button.hasAttribute('aria-describedby')).toBe(false);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(document.activeElement).toBe(button);
  });
});
