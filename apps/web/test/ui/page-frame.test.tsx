// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../../src/ui/button.tsx';
import { PageFrame } from '../../src/ui/page-frame.tsx';

afterEach(cleanup);

const toolbar = <input type="search" aria-label="Search articles" />;

describe('PageFrame', () => {
  it('E04-S07 a page frame shows one h1 from its title that can take focus, its actions, its toolbar and its content', () => {
    render(
      <PageFrame title="Articles" actions={<Button>New article</Button>} toolbar={toolbar}>
        <p>Rows 1 to 25 of 63</p>
      </PageFrame>,
    );

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Articles']);
    expect(headings[0]?.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('button', { name: 'New article' })).toBeDefined();
    expect(screen.getByRole('searchbox', { name: 'Search articles' })).toBeDefined();
    expect(screen.getByText('Rows 1 to 25 of 63').closest('[aria-busy="true"]')).toBeNull();
  });

  it('E04-S07 a loading page frame keeps its h1 and toolbar and marks its content busy', () => {
    render(
      <PageFrame title="Articles" toolbar={toolbar} state={{ status: 'loading' }}>
        <p>Skeleton rows</p>
      </PageFrame>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Articles' })).toBeDefined();
    expect(screen.getByRole('searchbox', { name: 'Search articles' })).toBeDefined();
    expect(screen.getByText('Skeleton rows').closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('E04-S07 an empty page frame shows its heading, its text and the action that creates the first item in place of the content', () => {
    render(
      <PageFrame
        title="Articles"
        toolbar={toolbar}
        state={{
          status: 'empty',
          title: 'No articles yet',
          description:
            'Articles come from Pyramid or are created here. Create the first one, or wait for the next import.',
          action: <Button>New article</Button>,
        }}
      >
        <p>Rows</p>
      </PageFrame>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'No articles yet' })).toBeDefined();
    expect(
      screen.getByText(
        'Articles come from Pyramid or are created here. Create the first one, or wait for the next import.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'New article' })).toBeDefined();
    expect(screen.getByRole('searchbox', { name: 'Search articles' })).toBeDefined();
    expect(screen.queryByText('Rows')).toBeNull();
  });

  it('E04-S07 an error page frame is an alert with the correlation id, which Copy correlation id copies and announces', async () => {
    const user = userEvent.setup();
    render(
      <PageFrame
        title="Articles"
        state={{
          status: 'error',
          title: 'Could not load articles',
          description:
            'Check the connection, then try again. If it fails again, give your plant admin the correlation id.',
          correlationId: '01J9Z6M2PQ7R4T8V1W3X5Y6Z8A',
          onRetry: vi.fn(),
        }}
      >
        <p>Rows</p>
      </PageFrame>,
    );

    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByRole('heading', { level: 2, name: 'Could not load articles' }),
    ).toBeDefined();
    expect(within(alert).getByText('01J9Z6M2PQ7R4T8V1W3X5Y6Z8A')).toBeDefined();
    expect(screen.queryByText('Rows')).toBeNull();
    await user.click(within(alert).getByRole('button', { name: 'Copy correlation id' }));

    expect(await navigator.clipboard.readText()).toBe('01J9Z6M2PQ7R4T8V1W3X5Y6Z8A');
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Correlation id copied',
      ),
    );
  });

  it('E04-S07 when the browser refuses the copy, the polite region says the correlation id was not copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('Write permission denied.', 'NotAllowedError'),
    );
    render(
      <PageFrame
        title="Articles"
        state={{
          status: 'error',
          title: 'Could not load articles',
          description: 'Check the connection, then try again.',
          correlationId: '01J9Z6M2PQ7R4T8V1W3X5Y6Z8A',
          onRetry: vi.fn(),
        }}
      >
        <p>Rows</p>
      </PageFrame>,
    );

    await user.click(screen.getByRole('button', { name: 'Copy correlation id' }));

    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Could not copy the correlation id. Select it and copy it by hand.',
      ),
    );
  });

  it('E04-S07 Try again retries and moves focus to the h1', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <PageFrame
        title="Articles"
        state={{
          status: 'error',
          title: 'Could not load articles',
          description: 'Check the connection, then try again.',
          onRetry,
        }}
      >
        <p>Rows</p>
      </PageFrame>,
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Articles' }),
    );
  });
});
