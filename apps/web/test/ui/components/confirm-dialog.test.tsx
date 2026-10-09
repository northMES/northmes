// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../../src/ui/components/confirm-dialog/index.ts';
import { Button } from '../../../src/ui/primitives/button.tsx';

afterEach(cleanup);

interface ArchiveProps {
  readonly onConfirm: () => Promise<void>;
}

/** Archive with its ConfirmDialog, and a heading that takes focus after a confirmed archive. */
function Archive({ onConfirm }: ArchiveProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        Article AX-500
      </h1>
      <ConfirmDialog
        trigger={<Button variant="outline">Archive</Button>}
        title="Archive article AX-500?"
        description="Archived articles are hidden from lists and cannot be changed until restored."
        confirmLabel="Archive article"
        onConfirm={onConfirm}
        focusAfterConfirm={() => heading.current}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('E04-S01 the trigger opens an alert dialog named by its title and described by its text', async () => {
    const user = userEvent.setup();
    render(<Archive onConfirm={vi.fn(async () => {})} />);

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Archive article AX-500?' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      within(dialog).getByText(
        'Archived articles are hidden from lists and cannot be changed until restored.',
      ),
    ).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Archive article' })).toBeDefined();
  });

  it('E04-S01 Cancel and Escape close the dialog without confirming, and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => {});
    render(<Archive onConfirm={onConfirm} />);
    const trigger = screen.getByRole('button', { name: 'Archive' });

    await user.click(trigger);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await user.click(trigger);
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('E04-S01 the confirm button runs the action, shows it busy, then closes the dialog and moves focus where the caller says', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Archive onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    const confirm = await screen.findByRole('button', { name: 'Archive article' });
    await user.click(confirm);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    finish();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Article AX-500' }),
      ),
    );
  });

  it('E04-S01 a failed action keeps the dialog open with its message as an alert, and the confirm button tries again', async () => {
    const user = userEvent.setup();
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('Could not archive the article. Try again.'))
      .mockResolvedValueOnce();
    render(<Archive onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await user.click(await screen.findByRole('button', { name: 'Archive article' }));

    const dialog = screen.getByRole('alertdialog');
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Could not archive the article. Try again.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Archive article' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
