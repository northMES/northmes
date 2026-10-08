// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Copy } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, IconButton } from '../../src/ui/button.tsx';

afterEach(cleanup);

describe('Button', () => {
  it('E04-S01 a button is named by its text and runs its action on Enter and on Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save article</Button>);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save article' }));
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('E04-S01 a loading button keeps focus and its name, reports busy and disabled, and ignores activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save article</Button>);
    await user.tab();

    rerender(
      <Button onClick={onClick} loading>
        Save article
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save article' });
    await user.keyboard('{Enter}');
    await user.click(button);

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('E04-S01 a disabled button is skipped by Tab', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button disabled>Previous</Button>
        <Button>Next</Button>
      </>,
    );

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
  });

  it('E04-S01 an icon button is named by its label, and its icon is hidden from assistive technology', () => {
    render(
      <IconButton label="Copy correlation id" variant="ghost">
        <Copy />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Copy correlation id' });
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
