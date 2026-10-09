// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreCreateUser } from '../../../src/modules/core/screens/new-user/create-user.graphql.ts';
import { CoreUserPermissions } from '../../../src/modules/core/screens/user/user-permissions.graphql.ts';
import { CoreUsers } from '../../../src/modules/core/screens/users/users.graphql.ts';
import {
  acme,
  anna,
  assignment,
  companiesQuery,
  companyId,
  forbiddenError,
  idOf,
  plantA,
  sara,
  settingsViewerQuery,
  shiftLead,
  user,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, renderCoreAt, watchForSkeletonRows } from './core-app.tsx';

afterEach(cleanup);

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** coreUsers' first page with these users, for the search when there is one, after delay ms. */
function usersQuery(
  nodes: readonly ReturnType<typeof user>[],
  search?: string,
  delay?: number,
): MockLink.MockedResponse {
  return {
    delay,
    request: {
      query: CoreUsers,
      variables: { companyId, first: 25, ...(search !== undefined && { search }) },
    },
    result: {
      data: {
        coreUsers: {
          __typename: 'UserConnection',
          totalCount: nodes.length,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          edges: nodes.map((node) => ({
            __typename: 'UserEdge',
            cursor: `cursor-${node.username}`,
            node: {
              ...node,
              roleAssignments: node.roleAssignments.map(({ role, ...rest }) => ({
                ...rest,
                role: role === null ? null : { __typename: 'Role', id: role.id, name: role.name },
              })),
            },
          })),
        },
      },
    },
  };
}

function field(name: string): HTMLInputElement {
  return screen.getByRole('textbox', { name }) as HTMLInputElement;
}

describe('users', () => {
  it('E04-S02 the users list in company settings shows each user with their username, their roles per place and their status, and New user for a user who may create users', async () => {
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
      usersQuery([
        user(anna, [], true),
        user(sara, [assignment(viewerRole, acme), assignment(shiftLead, plantA)]),
      ]),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Users' })).toBeDefined();
    const table = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() =>
      expect(bodyRows(table)).toEqual([
        ['Anna Berg', 'a.berg', 'No role', 'Blocked'],
        ['Sara Nyberg', 's.nyberg', 'Viewer at Acme ABShift lead at Plant A', 'Active'],
      ]),
    );
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((header) => header.textContent),
      ).toEqual(['Name', 'Username', 'Roles', 'Status']),
    );
    expect(screen.getByRole('link', { name: 'Sara Nyberg' }).getAttribute('href')).toBe(
      coreLinks.settings.users.user({ companyId, userId: sara.id }).href,
    );
    expect((await screen.findByRole('link', { name: 'New user' })).getAttribute('href')).toBe(
      coreLinks.settings.users.new({ companyId }).href,
    );
  });

  it('E06-S06 while a search of users loads, the list keeps the users it shows and is busy, with focus in the field (ui-222, LI7)', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read']),
      companiesQuery(),
      usersQuery([user(anna, []), user(sara, [])]),
      usersQuery([user(sara, [])], 'sara', 200),
    ]);
    const table = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));

    const search = screen.getByRole('searchbox', { name: 'Search users' });
    await events.type(search, 'sara');

    await waitFor(() => expect(table.getAttribute('aria-busy')).toBe('true'));
    expect(bodyRows(table).map(([name]) => name)).toEqual(['Anna Berg', 'Sara Nyberg']);
    expect(document.activeElement).toBe(search);

    await waitFor(() => expect(bodyRows(table).map(([name]) => name)).toEqual(['Sara Nyberg']));
    expect(table.getAttribute('aria-busy')).toBeNull();
    expect(document.activeElement).toBe(search);
  });

  it('E06-S06 a new search from No users match this search keeps that state, busy, until its users arrive, with no skeleton rows in between', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read']),
      companiesQuery(),
      usersQuery([user(anna, []), user(sara, [])]),
      usersQuery([], 'zz'),
      usersQuery([user(sara, [])], 'sara', 200),
    ]);
    const table = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    const search = screen.getByRole('searchbox', { name: 'Search users' });
    await events.type(search, 'zz');
    const noMatch = () =>
      screen.getByRole('heading', { level: 2, name: 'No users match this search' });
    await screen.findByRole('heading', { level: 2, name: 'No users match this search' });
    const skeletonRowsShown = watchForSkeletonRows();

    await events.type(search, '{Backspace}{Backspace}sara');

    await waitFor(() => expect(noMatch().closest('[aria-busy="true"]')).not.toBeNull());
    const users = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() => expect(bodyRows(users).map(([name]) => name)).toEqual(['Sara Nyberg']));
    expect(skeletonRowsShown()).toBe(false);
    expect(document.activeElement).toBe(search);
  });

  it('E05-S08 a reader without core.user:read at the company gets the page No access to Users', async () => {
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery([]),
      companiesQuery(),
      {
        request: { query: CoreUsers, variables: { companyId, first: 25 } },
        result: { data: null, errors: [forbiddenError(['coreUsers'])] },
      },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to Users' }),
    ).toBeDefined();
    expect(
      await screen.findByText(
        'Opening Users needs the permission to read users and their roles (core.user:read) at Acme AB. Ask a company admin of Acme AB for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('E05-S08 New user needs core.user:create at the company: a reader of users without it gets the page No access to New user, and the list shows no New user', async () => {
    const router = renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read']),
      companiesQuery(),
      usersQuery([user(sara, [])]),
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to New user' }),
    ).toBeDefined();
    expect(
      await screen.findByText(
        'Opening New user needs the permission to create users (core.user:create) at Acme AB. Ask a company admin of Acme AB for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();

    await router.navigate({ to: coreLinks.settings.users({ companyId }).href });
    expect(await screen.findByRole('link', { name: 'Sara Nyberg' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'New user' })).toBeNull();
  });

  it('E05-S08 Create user with empty fields shows each message in the summary, which takes focus, and sends nothing', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 3 fields to create the user' });
    expect(document.activeElement).toBe(summary);
    expect(field('Username').getAttribute('aria-invalid')).toBe('true');
    expect(field('Name').getAttribute('aria-invalid')).toBe('true');
    expect(field('Email').getAttribute('aria-invalid')).toBe('true');
    expect(within(summary).getByRole('link', { name: /^Enter an email address/ })).toBeDefined();
  });

  it('E05-S08 New user requires Email, the address the user signs in with, and offers no way to leave it empty', async () => {
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
    ]);

    const email = await screen.findByRole('textbox', { name: 'Email' });

    expect(email.getAttribute('type')).toBe('email');
    expect(screen.getByText('Used to sign in.')).toBeDefined();
    expect(
      screen.getByText(
        'Shown in lists of users. It cannot be changed later, and no one else can ever use it.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/without email/)).toBeNull();
  });

  it('E05-S08 a username that is taken or was used before lands on Username with the typed values kept', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            uuidv7.test(input.id ?? '') &&
            input.name === 'Tove Lindqvist' &&
            input.username === 't.lindqvist' &&
            input.email === 'tove.lindqvist@example.test' &&
            input.companyId === companyId,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'The username is taken.',
              path: ['coreCreateUser'],
              extensions: {
                code: 'CONFLICT',
                errorCode: 'core.username_taken',
                fieldErrors: [
                  {
                    path: ['username'],
                    message: 'The username is taken.',
                    code: 'core.username_taken',
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Tove Lindqvist');
    await user.type(field('Username'), 't.lindqvist');
    await user.type(field('Email'), 'tove.lindqvist@example.test');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to create the user' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByRole('link').textContent).toBe(
      'The username t.lindqvist is taken or was used before. Choose another username.',
    );
    expect(field('Username').value).toBe('t.lindqvist');
    expect(field('Name').value).toBe('Tove Lindqvist');
  });

  it("E05-S08 a retry whose first run created the user says the user was created without a password to show and opens the user's page", async () => {
    const user = userEvent.setup();
    const tove = idOf('tove');
    const router = renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            uuidv7.test(input.id ?? '') &&
            input.name === 'Tove Lindqvist' &&
            input.username === 't.lindqvist' &&
            input.email === 'tove.lindqvist@example.test' &&
            input.companyId === companyId,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'The user was created before.',
              path: ['coreCreateUser'],
              extensions: {
                code: 'CONFLICT',
                errorCode: 'core.user_created_password_hidden',
                details: { userId: tove },
              },
            },
          ],
        },
      },
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Tove Lindqvist');
    await user.type(field('Username'), 't.lindqvist');
    await user.type(field('Email'), 'tove.lindqvist@example.test');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'The user t.lindqvist was created' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(field('Username').getAttribute('aria-invalid')).not.toBe('true');
    expect(summary.textContent).toContain('NorthMES cannot show the temporary password again.');

    await user.click(within(summary).getByRole('button', { name: 'Open user' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        coreLinks.settings.users.user({ companyId, userId: tove }).href,
      ),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it("E05-S08 a created user's page replaces the form and shows the temporary password once, with focus on Copy password; Done closes it and focus goes to the h1", async () => {
    const user = userEvent.setup();
    const tove = {
      __typename: 'User',
      id: idOf('tove'),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
    } as const;
    const router = renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            uuidv7.test(input.id ?? '') &&
            input.name === 'Tove Lindqvist' &&
            input.username === 't.lindqvist' &&
            input.email === 'tove.lindqvist@example.test' &&
            input.companyId === companyId,
        },
        result: {
          data: {
            coreCreateUser: {
              __typename: 'CreatedUser',
              temporaryPassword: 'fictional-temp-4821',
              user: { ...tove, blocked: false, roleAssignments: [] },
            },
          },
        },
      },
      {
        request: { query: CoreUserPermissions, variables: { id: tove.id, companyId } },
        result: {
          data: { coreUser: { __typename: 'User', id: tove.id, effectivePermissions: [] } },
        },
      },
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Tove Lindqvist');
    await user.type(field('Username'), 'T.Lindqvist');
    await user.type(field('Email'), 'tove.lindqvist@example.test');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Temporary password for Tove Lindqvist',
    });
    expect(router.state.location.pathname).toBe(
      coreLinks.settings.users.user({ companyId, userId: tove.id }).href,
    );
    expect(
      (within(dialog).getByRole('textbox', { name: 'Temporary password' }) as HTMLInputElement)
        .value,
    ).toBe('fictional-temp-4821');
    expect(dialog.textContent).toContain(
      'Give it to Tove Lindqvist, who must choose a new password at the next sign-in.',
    );
    expect(dialog.textContent).not.toContain('The old password no longer works.');
    expect(
      within(dialog).getByText(
        'Shown only now. After you close this dialog, it cannot be shown again.',
      ),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: 'Copy password' }),
      ),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Tove Lindqvist' }),
      ),
    );
    // Back on the user's page later, the password is gone.
    router.history.back();
    router.history.forward();
    expect(screen.queryByText('fictional-temp-4821')).toBeNull();
  });
});
