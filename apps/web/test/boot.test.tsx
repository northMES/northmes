// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootWeb } from '../src/boot/index.ts';

const indexHtml = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');

const pageOrigin = 'https://web.northmes.test';

/** Puts index.html's body in the document, as the browser shows it before any script runs. */
function loadIndexHtml(): HTMLElement {
  const page = new DOMParser().parseFromString(indexHtml, 'text/html');
  // The entry script is what the tests call; the document only shows the markup.
  for (const script of page.querySelectorAll('script')) script.remove();
  document.title = page.title;
  document.body.innerHTML = page.body.innerHTML;
  return document.getElementById('root') as HTMLElement;
}

/** Boots the web in index.html with this fetch; the app is a heading once it starts. */
async function boot(fetch: (url: string) => Promise<Response>) {
  const root = loadIndexHtml();
  const reload = vi.fn();
  await act(() =>
    bootWeb(root, {
      fetch,
      origin: pageOrigin,
      app: ({ apiUrl }) => <h1>NorthMES at {apiUrl}</h1>,
      reload,
      retryAfterMs: 20,
    }),
  );
  return { root, reload };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('the boot page', () => {
  it('E04-S02 index.html shows Loading NorthMES in a busy main before any script runs, with the skip link first and the polite region outside #root (BO1)', () => {
    const root = loadIndexHtml();

    expect(document.title).toBe('Loading · NorthMES');
    const main = within(root).getByRole('main');
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(within(main).getByRole('heading', { level: 1, name: 'Loading NorthMES' })).toBeDefined();
    expect(main.textContent).toContain('Starting NorthMES in this browser.');
    const [first] = within(root).getAllByRole('link');
    expect(first?.textContent).toBe('Skip to main content');
    expect(root.contains(document.getElementById('announcer-polite'))).toBe(false);
  });

  it('E04-S02 once config.json loads, the app replaces the boot page', async () => {
    await boot(async () => Response.json({ apiUrl: 'https://api.northmes.test' }));

    expect(
      await screen.findByRole('heading', { name: 'NorthMES at https://api.northmes.test' }),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Loading NorthMES' })).toBeNull();
  });

  it('E04-S02 a server error at boot shows NorthMES could not start in a card with Reload page, announced once and with nothing focused (BO3)', async () => {
    const user = userEvent.setup();
    const { root, reload } = await boot(async () => new Response('', { status: 500 }));

    const main = within(root).getByRole('main');
    expect(
      within(main).getByRole('heading', { level: 1, name: 'NorthMES could not start' }),
    ).toBeDefined();
    expect(main.getAttribute('aria-busy')).toBeNull();
    expect(main.textContent).toContain(
      'The server sent an error when this browser asked for its settings, so no page can open.',
    );
    expect(main.textContent).toContain('Reload to try again.');
    expect(main.textContent).not.toContain('config.json');
    expect(document.title).toBe('NorthMES could not start · NorthMES');
    expect(document.activeElement).toBe(document.body);
    await waitFor(() =>
      expect(document.getElementById('announcer-polite')?.textContent).toBe(
        'NorthMES could not start.',
      ),
    );
    await user.tab();
    expect(document.activeElement?.textContent).toBe('Skip to main content');
    await user.click(within(main).getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('E04-S02 an invalid config.json shows the same card, never the raw reason', async () => {
    const { root } = await boot(async () => Response.json({ apiUrl: '/api' }));

    const main = within(root).getByRole('main');
    expect(within(main).getByRole('heading', { name: 'NorthMES could not start' })).toBeDefined();
    expect(main.textContent).not.toContain('apiUrl');
  });

  it('E04-S02 no answer at boot says NorthMES did not answer, tries again by itself, and opens NorthMES once it answers (BO6)', async () => {
    const fetch = vi
      .fn<(url: string) => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(Response.json({ apiUrl: 'https://api.northmes.test' }));
    const { root } = await boot(fetch);

    const main = within(root).getByRole('main');
    expect(within(main).getByRole('heading', { name: 'NorthMES could not start' })).toBeDefined();
    expect(main.textContent).toContain(
      'NorthMES did not answer. It may be restarting, or this browser cannot reach the server.',
    );
    expect(main.textContent).toContain(
      'This page tries again every 10 seconds and opens NorthMES when it answers.',
    );
    expect(within(main).getByRole('button', { name: 'Reload page' })).toBeDefined();
    expect(
      await screen.findByRole('heading', { name: 'NorthMES at https://api.northmes.test' }),
    ).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
