// SPDX-License-Identifier: AGPL-3.0-or-later
import { CombinedGraphQLErrors } from '@apollo/client';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageFrame, type PageState } from '../../../src/ui/components/page-frame/index.ts';
import { Button } from '../../../src/ui/primitives/button.tsx';

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

  it('E06-S06 a page frame names the document after its title, and follows a new title', () => {
    const { rerender } = render(
      <PageFrame title="Article">
        <p>Skeleton</p>
      </PageFrame>,
    );
    expect(document.title).toBe('Article · NorthMES');

    rerender(
      <PageFrame title="Article AX-500">
        <p>Identity</p>
      </PageFrame>,
    );
    expect(document.title).toBe('Article AX-500 · NorthMES');
  });

  it('E06-S06 when the page frame goes away, the document title returns to NorthMES', () => {
    const { unmount } = render(
      <PageFrame title="Articles">
        <p>Rows</p>
      </PageFrame>,
    );
    expect(document.title).toBe('Articles · NorthMES');

    unmount();

    expect(document.title).toBe('NorthMES');
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

  it('E04-S07 an error page frame is an alert with the correlation id below it, which Copy correlation id copies and announces', async () => {
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
    expect(screen.getByText('01J9Z6M2PQ7R4T8V1W3X5Y6Z8A')).toBeDefined();
    expect(screen.queryByText('Rows')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Copy correlation id' }));

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

  it('E04-S07 the error state takes the correlation id from the failed request, and then asks for it (ui-222 ST4)', () => {
    const error = new CombinedGraphQLErrors({
      data: null,
      errors: [
        {
          message: 'Internal server error',
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            errorCode: 'core.internal',
            correlationId: '0199c4e2-7b1d-7a52-8f3e-5d21c6a9b04e',
          },
        },
      ],
    });
    render(
      <PageFrame
        title="Articles"
        state={{ status: 'error', title: 'Could not load articles', error, onRetry: vi.fn() }}
      >
        <p>Rows</p>
      </PageFrame>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(
      'Check the connection, then try again. If it fails again, give your plant admin the correlation id.',
    );
    expect(screen.getByText('0199c4e2-7b1d-7a52-8f3e-5d21c6a9b04e')).toBeDefined();
  });

  it('E04-S07 without a correlation id the error state only asks to check the connection and try again', () => {
    render(
      <PageFrame
        title="Articles"
        state={{
          status: 'error',
          title: 'Could not load articles',
          error: new TypeError('Failed to fetch'),
          onRetry: vi.fn(),
        }}
      >
        <p>Rows</p>
      </PageFrame>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Check the connection, then try again.');
    expect(alert.textContent).not.toContain('correlation id');
  });

  /** A page whose load failed, and whose retry the test settles. */
  function RetryPage({ retry }: { readonly retry: () => Promise<PageState> }) {
    const [state, setState] = useState<PageState>({
      status: 'error',
      title: 'Could not load articles',
      onRetry: async () => {
        setState({ status: 'loading' });
        setState(await retry());
      },
    });
    return (
      <PageFrame title="Articles" state={state}>
        <p>Rows</p>
      </PageFrame>
    );
  }

  it('E04-S07 Try again keeps focus in its loading state while the request runs, and moves focus to the h1 once the page loads (shell-306 SE7)', async () => {
    const user = userEvent.setup();
    let loaded: (state: PageState) => void = () => {};
    render(<RetryPage retry={() => new Promise((resolve) => (loaded = resolve))} />);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    const busy = screen.getByRole('button', { name: 'Trying again' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(busy);
    loaded({ status: 'ready' });
    await screen.findByText('Rows');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Articles' }),
      ),
    );
  });

  it('E04-S07 a Try again that fails keeps focus on Try again and says once that the page still could not be loaded', async () => {
    const user = userEvent.setup();
    let failed: (state: PageState) => void = () => {};
    render(<RetryPage retry={() => new Promise((resolve) => (failed = resolve))} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    failed({
      status: 'error',
      title: 'Could not load articles',
      onRetry: vi.fn(),
    });

    const tryAgain = await screen.findByRole('button', { name: 'Try again' });
    expect(document.activeElement).toBe(tryAgain);
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Still could not load articles.',
      ),
    );
  });

  it('E04-S07 the alert holds only the heading and the text, so Try again and a new correlation id leave it unchanged (shell-306 E22)', async () => {
    const user = userEvent.setup();
    let failed: (state: PageState) => void = () => {};
    function FailingPage() {
      const [state, setState] = useState<PageState>({
        status: 'error',
        title: 'Could not load articles',
        correlationId: '01J9Z6M2PQ7R4T8V1W3X5Y6Z8A',
        onRetry: async () => {
          setState({ status: 'loading' });
          setState(await new Promise<PageState>((resolve) => (failed = resolve)));
        },
      });
      return (
        <PageFrame title="Articles" state={state}>
          <p>Rows</p>
        </PageFrame>
      );
    }
    render(<FailingPage />);
    const alert = screen.getByRole('alert');
    const announced = alert.textContent;
    expect(within(alert).queryByRole('button')).toBeNull();
    expect(announced).not.toContain('01J9Z6M2PQ7R4T8V1W3X5Y6Z8A');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Trying again' })).toBeDefined();
    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert.textContent).toBe(announced);
    failed({
      status: 'error',
      title: 'Could not load articles',
      correlationId: '01J9Z7A0B1C2D3E4F5G6H7J8K9',
      onRetry: vi.fn(),
    });

    await screen.findByText('01J9Z7A0B1C2D3E4F5G6H7J8K9');
    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert.textContent).toBe(announced);
  });

  it('E06-S06 when the action of an empty state takes the state and the focus away, focus moves to the h1', async () => {
    const user = userEvent.setup();
    function OutOfDate() {
      const [state, setState] = useState<PageState>({
        status: 'empty',
        title: 'This page of results is out of date',
        description: 'The rows changed since this link was made.',
        action: (
          <Button onClick={() => setState({ status: 'loading' })}>Go to the first page</Button>
        ),
      });
      return (
        <PageFrame title="Articles" state={state}>
          <p>Rows</p>
        </PageFrame>
      );
    }
    render(<OutOfDate />);

    await user.click(screen.getByRole('button', { name: 'Go to the first page' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Articles' }),
      ),
    );
  });

  it('E06-S06 when the action of an empty state moves focus itself, the focus stays there', async () => {
    const user = userEvent.setup();
    function FilteredEmpty() {
      const [state, setState] = useState<PageState>({
        status: 'empty',
        title: 'No articles match these filters',
        description: 'Change or clear the filters to see articles again.',
        action: (
          <Button
            onClick={() => {
              setState({ status: 'loading' });
              document.getElementById('search')?.focus();
            }}
          >
            Clear filters
          </Button>
        ),
      });
      return (
        <PageFrame
          title="Articles"
          toolbar={<input id="search" aria-label="Search" />}
          state={state}
        >
          <p>Rows</p>
        </PageFrame>
      );
    }
    render(<FilteredEmpty />);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
  });
});
