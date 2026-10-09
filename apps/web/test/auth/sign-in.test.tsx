// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { defineWebModule } from '@northmes/web-sdk';
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShellModule } from '../../src/modules.ts';
import { createShellRouter } from '../../src/shell/index.ts';
import {
  alexEmail,
  fakeSession,
  rateLimitedEmail,
  toveEmail,
  toveTemporaryPassword,
} from './fake-session.ts';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.title = '';
});

const pingQuery = gql`
  query Ping {
    ping
  }
`;

function PingScreen() {
  const { data, error } = useQuery<{ ping: string }>(pingQuery);
  if (error) return <p>{error.message}</p>;
  return <h1>{data ? `The API answered ${data.ping}` : 'Loading'}</h1>;
}

const quality: ShellModule = {
  label: 'Quality',
  order: 10,
  links: [
    {
      label: 'Inspections',
      icon: 'ListChecks',
      link: ({ plant }) => ({ href: `/${plant}/quality` }),
    },
  ],
  module: defineWebModule({
    id: 'quality',
    version: '0.4.0',
    routes: (plantRoute) =>
      createRoute({ getParentRoute: () => plantRoute, path: 'quality', component: PingScreen }),
  }),
};

const pong = () =>
  new Response(JSON.stringify({ data: { ping: 'pong' } }), {
    headers: { 'content-type': 'application/graphql-response+json' },
  });

/** The calls of fetch that sent the operation named operation. */
function callsOf(
  fetch: { mock: { calls: Parameters<typeof globalThis.fetch>[] } },
  operation: string,
) {
  return fetch.mock.calls.filter(
    ([, init]) =>
      (JSON.parse(String(init?.body)) as { operationName?: string }).operationName === operation,
  );
}

/** Renders the web's router at path with the session, and returns the router. */
function renderAt(
  path: string,
  session: ReturnType<typeof fakeSession>,
  fetch = vi.fn<typeof globalThis.fetch>(async () => pong()),
) {
  const router = createShellRouter([quality], {
    session,
    fetch,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return { router, fetch };
}

/** Types the email and password into the sign-in form and presses Sign in. */
async function signIn(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  if (email !== '') await user.type(screen.getByLabelText('Email'), email);
  if (password !== '') await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('sign-in', () => {
  it('E05-S05 a viewer without a session who opens a plant page gets the sign-in page, and signing in returns them to that page', async () => {
    const user = userEvent.setup();
    const session = fakeSession({ signedIn: false });
    const { fetch } = renderAt('/plant-a/quality?tab=open', session);

    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    expect(document.title).toBe('Sign in · NorthMES');
    expect(fetch).not.toHaveBeenCalled();
    await signIn(user, alexEmail, 'correct horse');

    expect(await screen.findByRole('heading', { name: 'The API answered pong' })).toBeDefined();
    expect(session.signIn).toHaveBeenCalledWith(alexEmail, 'correct horse');
    expect(new Headers(callsOf(fetch, 'Ping')[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer jwt-1',
    );
  });

  it('E05-S05 the sign-in form names its fields for password managers', async () => {
    renderAt('/sign-in', fakeSession({ signedIn: false }));

    const email = await screen.findByLabelText('Email');
    const password = screen.getByLabelText('Password');

    expect([
      email.getAttribute('type'),
      email.getAttribute('autocomplete'),
      email.getAttribute('autocapitalize'),
      email.getAttribute('spellcheck'),
      password.getAttribute('type'),
      password.getAttribute('autocomplete'),
    ]).toEqual(['email', 'username', 'none', 'false', 'password', 'current-password']);
    expect(screen.queryByLabelText('Username or email')).toBeNull();
    expect(screen.getByText('Forgot your password? Ask a plant admin to reset it.')).toBeDefined();
  });

  it('E05-S05 Sign in with both fields empty focuses a summary that links each field, and marks both fields', async () => {
    const user = userEvent.setup();
    const session = fakeSession({ signedIn: false });
    renderAt('/sign-in', session);
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });

    await signIn(user, '', '');

    const summary = screen.getByRole('group', { name: 'Fix 2 fields to sign in' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Enter your email', 'Enter your password']);
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter your email.')).toBeDefined();
    expect(screen.getByText('Enter your password.')).toBeDefined();
    expect(session.signIn).not.toHaveBeenCalled();
  });

  it('E05-S05 a username in Email is refused on the page with the email field error, and the API is not asked', async () => {
    const user = userEvent.setup();
    const session = fakeSession({ signedIn: false });
    renderAt('/sign-in', session);
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });

    await signIn(user, 'alex.lund', 'correct horse');

    const summary = screen.getByRole('group', { name: 'Fix 1 field to sign in' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Enter an email address, such as name@example.com']);
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter an email address, such as name@example.com.')).toBeDefined();
    expect(session.signIn).not.toHaveBeenCalled();
  });

  it('E05-S05 a wrong password keeps the email, clears and marks the password, and focuses the summary', async () => {
    const user = userEvent.setup();
    renderAt('/sign-in', fakeSession({ signedIn: false }));
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });

    await signIn(user, alexEmail, 'Correct horse');

    const summary = await screen.findByRole('group', {
      name: 'The email or password is wrong',
    });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByText('Passwords are case-sensitive.')).toBeDefined();
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(alexEmail);
    expect(password.value).toBe('');
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('Enter your password again. Passwords are case-sensitive.'),
    ).toBeDefined();
    await user.click(within(summary).getByRole('link', { name: 'Enter your password again' }));
    expect(document.activeElement).toBe(password);
  });

  it('E05-S05 a rate-limited sign-in says how long to wait and keeps the email', async () => {
    const user = userEvent.setup();
    renderAt('/sign-in', fakeSession({ signedIn: false }));
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });

    await signIn(user, rateLimitedEmail, 'anything');

    const summary = await screen.findByRole('group', { name: 'Too many sign-in attempts' });
    expect(within(summary).getByText('Wait 7 seconds, then sign in again.')).toBeDefined();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(rateLimitedEmail);
  });

  it('E05-S05 a second refusal moves focus to the summary once it names the new refusal, so a screen reader reads the new error', async () => {
    const user = userEvent.setup();
    renderAt('/sign-in', fakeSession({ signedIn: false }));
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    await signIn(user, alexEmail, 'Correct horse');
    await screen.findByRole('group', { name: 'The email or password is wrong' });
    await user.clear(screen.getByLabelText('Email'));

    // The heading the summary holds each time it takes focus.
    const focused: string[] = [];
    const record = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (target.getAttribute('role') === 'group') {
        focused.push(target.querySelector('h2')?.textContent ?? '');
      }
    };
    document.addEventListener('focusin', record);
    await signIn(user, rateLimitedEmail, 'anything');

    const summary = await screen.findByRole('group', { name: 'Too many sign-in attempts' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    document.removeEventListener('focusin', record);
    expect(focused).toEqual(['Too many sign-in attempts']);
  });

  it('E05-S05 the user menu names the signed-in user and offers Sign out', async () => {
    const user = userEvent.setup();
    renderAt('/plant-a/quality', fakeSession());

    const userButton = await screen.findByRole('button', { name: 'Alex Lund, alex.lund, account' });
    await user.click(userButton);

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Alex Lund')).toBeDefined();
    expect(within(menu).getByText('alex.lund')).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeDefined();
  });

  it('E05-S05 Sign out ends the session, clears the Apollo cache and shows the sign-in page with "You are signed out"', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const { router, fetch } = renderAt('/plant-a/quality', session);
    await screen.findByRole('heading', { name: 'The API answered pong' });

    await user.click(screen.getByRole('button', { name: 'Alex Lund, alex.lund, account' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(session.signOut).toHaveBeenCalledOnce();
    expect(screen.getByText('You are signed out')).toBeDefined();
    await waitFor(() =>
      expect(document.getElementById('announcer-polite')?.textContent).toBe('You are signed out.'),
    );
    // The next user who signs in and opens the page reads it from the API, not from the cache.
    router.history.push('/plant-a/quality');
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    await signIn(user, alexEmail, 'correct horse');
    await screen.findByRole('heading', { name: 'The API answered pong' });
    expect(callsOf(fetch, 'Ping')).toHaveLength(2);
  });

  it('E05-S05 a 401 from the API forgets the session and sends the viewer to sign-in, which returns them to the page', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockImplementation(async () => pong());
    renderAt('/plant-a/quality', session, fetch);

    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    expect(session.forget).toHaveBeenCalled();
    await signIn(user, alexEmail, 'correct horse');

    expect(await screen.findByRole('heading', { name: 'The API answered pong' })).toBeDefined();
  });

  it('E05-S05 after a 401 the sign-in page says the session ended, focuses its h1 and announces it once, with only the return path in the URL (shell-306 SO1)', async () => {
    const session = fakeSession();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockImplementation(async () => pong());
    const { router } = renderAt('/plant-a/quality?tab=open', session, fetch);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    const box = screen.getByRole('group', { name: 'Your session ended' });
    expect(box.textContent).toContain('Sign in again to go back to the page you were on.');
    expect(box.getAttribute('aria-live')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(heading));
    await waitFor(() =>
      expect(document.getElementById('announcer-polite')?.textContent).toBe(
        'Your session ended. Sign in again to continue.',
      ),
    );
    expect(router.state.location.search).toEqual({ redirect: '/plant-a/quality?tab=open' });
  });

  it('E05-S05 a viewer who opens a page without a session gets no session ended box, and nothing takes focus', async () => {
    renderAt('/plant-a/quality', fakeSession({ signedIn: false }));

    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    expect(screen.queryByRole('group', { name: 'Your session ended' })).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('E05-S08 after a sign-in with a temporary password the new password step shows, with focus in New password', async () => {
    const user = userEvent.setup();
    const session = fakeSession({ signedIn: false });
    const { fetch } = renderAt('/plant-a/quality', session);
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });

    await signIn(user, toveEmail, toveTemporaryPassword);

    const heading = await screen.findByRole('heading', { level: 1, name: 'Set a new password' });
    const field = screen.getByLabelText('New password');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(document.title).toBe('Set a new password · NorthMES');
    expect(
      screen.getByText(
        'You signed in with a temporary password. Choose a new password to continue.',
      ),
    ).toBeDefined();
    expect(screen.getByText('tove.lindqvist')).toBeDefined();
    const account = heading
      .closest('main')
      ?.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    expect([account?.value, account?.readOnly, account?.tabIndex]).toEqual([toveEmail, true, -1]);
    expect([field.getAttribute('type'), field.getAttribute('autocomplete')]).toEqual([
      'password',
      'new-password',
    ]);
    expect(screen.getByText('Use at least 8 characters.')).toBeDefined();
    const show = screen.getByRole('button', { name: 'Show password' });
    await user.click(show);
    expect([field.getAttribute('type'), show.getAttribute('aria-pressed')]).toEqual([
      'text',
      'true',
    ]);
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('E05-S08 Sign out on the new password step returns to sign-in without saving', async () => {
    const user = userEvent.setup();
    const session = fakeSession({ signedIn: false });
    renderAt('/plant-a/quality', session);
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    await signIn(user, toveEmail, toveTemporaryPassword);
    await user.type(await screen.findByLabelText('New password'), 'a password of mine');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' }),
    ).toBeDefined();
    expect(session.signOut).toHaveBeenCalledOnce();
    expect(session.setNewPassword).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('E05-S08 after saving a new password the user lands on the return path, and a refused one stays on the step with its error', async () => {
    const user = userEvent.setup();
    const session = fakeSession({ signedIn: false });
    renderAt('/plant-a/quality?tab=open', session);
    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    await signIn(user, toveEmail, toveTemporaryPassword);
    const field = await screen.findByLabelText('New password');

    await user.type(field, toveTemporaryPassword);
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    const summary = await screen.findByRole('group', { name: 'Fix 1 field to continue' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getAllByText('Choose a password other than the temporary one.').length,
    ).toBeGreaterThan(0);
    await user.clear(field);
    await user.type(field, 'a password of mine');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByRole('heading', { name: 'The API answered pong' })).toBeDefined();
    expect(session.setNewPassword).toHaveBeenLastCalledWith(
      toveTemporaryPassword,
      'a password of mine',
    );
  });

  it('E05-S08 a core.password_change_required answer mid-session, as after a reset, ends the session and sends the user to sign in again, then to the new password step and back to the page', async () => {
    const user = userEvent.setup();
    const session = fakeSession();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: null,
            errors: [
              {
                message: 'Choose a new password to continue.',
                extensions: { code: 'FORBIDDEN', errorCode: 'core.password_change_required' },
              },
            ],
          }),
          { headers: { 'content-type': 'application/graphql-response+json' } },
        ),
      )
      .mockImplementation(async () => pong());
    const { router } = renderAt('/plant-a/quality?tab=open', session, fetch);

    await screen.findByRole('heading', { level: 1, name: 'Sign in to NorthMES' });
    expect(session.signOut).toHaveBeenCalledOnce();
    expect(router.state.location.search).toEqual({ redirect: '/plant-a/quality?tab=open' });
    await signIn(user, toveEmail, toveTemporaryPassword);
    await user.type(await screen.findByLabelText('New password'), 'a password of mine');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByRole('heading', { name: 'The API answered pong' })).toBeDefined();
    expect(router.state.location.href).toBe('/plant-a/quality?tab=open');
  });
});
