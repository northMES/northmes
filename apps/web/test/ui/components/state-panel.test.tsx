// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CircleAlert } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatePanel } from '../../../src/ui/components/state-panel/index.ts';
import { politeRegionId } from '../../../src/ui/lib/announce.ts';

afterEach(cleanup);

describe('StatePanel', () => {
  it('E04-S02 lists its rows as terms and values, and Copy correlation id copies the id, keeps focus and says so once', async () => {
    const user = userEvent.setup();
    render(
      <StatePanel
        icon={CircleAlert}
        tone="destructive"
        lead="The server stopped with an error."
        rows={[
          {
            label: 'Correlation id',
            value: '0199c4e2-7b1d-7a52-8f3e-5d21c6a9b04e',
            copyLabel: 'Copy correlation id',
            copiedMessage: 'Correlation id copied',
          },
          { label: 'Code', value: 'core.internal' },
        ]}
      />,
    );

    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    expect(terms).toEqual(['Correlation id', 'Code']);
    const copy = screen.getByRole('button', { name: 'Copy correlation id' });
    await user.click(copy);

    expect(await navigator.clipboard.readText()).toBe('0199c4e2-7b1d-7a52-8f3e-5d21c6a9b04e');
    expect(document.activeElement).toBe(copy);
    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe('Correlation id copied'),
    );
    expect(within(screen.getAllByRole('definition')[1] as HTMLElement).queryByRole('button')).toBe(
      null,
    );
  });

  it('E04-S02 when the browser refuses the copy, the polite region names the row that was not copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('Write permission denied.', 'NotAllowedError'),
    );
    render(
      <StatePanel
        icon={CircleAlert}
        tone="destructive"
        lead="The server stopped with an error."
        rows={[{ label: 'Code', value: 'core.internal', copyLabel: 'Copy code' }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    await waitFor(() =>
      expect(document.getElementById(politeRegionId)?.textContent).toBe(
        'Could not copy the code. Select it and copy it by hand.',
      ),
    );
  });
});
