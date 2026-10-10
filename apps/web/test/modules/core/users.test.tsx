// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreCompanies } from '../../../src/modules/core/companies.graphql.ts';
import { CoreCreateUser } from '../../../src/modules/core/screens/new-user/create-user.graphql.ts';
import { CoreUserPermissions } from '../../../src/modules/core/screens/user/user-permissions.graphql.ts';
import { CoreUsers } from '../../../src/modules/core/screens/users/users.graphql.ts';
import {
  acme,
  anna,
  assignment,
  catalogQuery,
  companiesQuery,
  companyId,
  forbiddenError,
  groupedRows,
  idOf,
  person,
  plantA,
  rolesQuery,
  sara,
  settingsViewerQuery,
  shiftLead,
  user,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, renderCoreAt, watchForSkeletonRows } from './core-app.tsx';
import { resetPasswordMutation, temporaryPassword, userAdmin } from './user-fixtures.ts';

afterEach(cleanup);

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * coreUsers' first page with these users, for the search when there is one, after delay ms, with
 * the filters and the sort of `more`.
 */
function usersQuery(
  nodes: readonly ReturnType<typeof user>[],
  search?: string,
  delay?: number,
  more: Record<string, unknown> = {},
): MockLink.MockedResponse {
  return {
    delay,
    request: {
      query: CoreUsers,
      variables: { companyId, first: 25, ...(search !== undefined && { search }), ...more },
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

  /** The signed-in user, Jonas Holm, whose own row has no menu. */
  const jonas = person('Jonas Holm', 'jonas');

  /** The users of the row menu tests: Anna Berg is blocked, Sara Nyberg and Jonas Holm active. */
  const listed = [user(anna, [], true), user(jonas, []), user(sara, [])];

  /** The names of the items of the open menu. */
  function itemsOf(menu: HTMLElement): string[] {
    return within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent ?? '');
  }

  it("E05-S08 each user's row has an Actions menu that opens with focus on its first item and closes with Escape back on its button, and your own row has none", async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      usersQuery(listed),
    ]);

    const button = await screen.findByRole('button', { name: 'Actions for Sara Nyberg' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    button.focus();
    await events.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Actions for Sara Nyberg' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(menu).getByRole('menuitem', { name: 'Reset password' }),
      ),
    );
    expect(itemsOf(menu)).toEqual(['Reset password', 'Block user']);
    await events.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));

    await events.click(screen.getByRole('button', { name: 'Actions for Anna Berg' }));
    expect(itemsOf(await screen.findByRole('menu', { name: 'Actions for Anna Berg' }))).toEqual([
      'Unblock user',
    ]);
    expect(screen.queryByRole('button', { name: 'Actions for Jonas Holm' })).toBeNull();
  });

  it('E05-S08 the row menu shows each item by permission, and a reader who may do neither gets no menu', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:block']),
      companiesQuery(),
      usersQuery(listed),
    ]);

    await events.click(await screen.findByRole('button', { name: 'Actions for Sara Nyberg' }));
    expect(itemsOf(await screen.findByRole('menu'))).toEqual(['Block user']);
    cleanup();

    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read']),
      companiesQuery(),
      usersQuery(listed),
    ]);
    expect(await screen.findByRole('link', { name: 'Sara Nyberg' })).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
  });

  it("E05-S08 Reset password from a row's menu opens the same dialogs as the user's page, and Done returns focus to the row's Actions button", async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      usersQuery(listed),
      resetPasswordMutation(sara),
    ]);

    const button = await screen.findByRole('button', { name: 'Actions for Sara Nyberg' });
    await events.click(button);
    await events.click(await screen.findByRole('menuitem', { name: 'Reset password' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Reset the password of Sara Nyberg?',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(confirm).getByRole('textbox', { name: 'Reason (optional)' }),
      ),
    );
    await events.click(within(confirm).getByRole('button', { name: 'Reset password' }));
    const shown = await screen.findByRole('dialog', { name: 'Temporary password for Sara Nyberg' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(shown).getByRole('button', { name: 'Copy password' }),
      ),
    );
    expect(
      (within(shown).getByRole('textbox', { name: 'Temporary password' }) as HTMLInputElement)
        .value,
    ).toBe(temporaryPassword);
    await events.click(within(shown).getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Actions for Sara Nyberg' }),
      ),
    );
  });

  it("E05-S08 a dialog of a row's menu opens without the reason and the error of its last opening", async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(userAdmin),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      usersQuery(listed),
      { ...resetPasswordMutation(sara, 'Forgot it'), result: undefined, error: new Error('Down') },
    ]);

    const button = await screen.findByRole('button', { name: 'Actions for Sara Nyberg' });
    await events.click(button);
    await events.click(await screen.findByRole('menuitem', { name: 'Reset password' }));
    let confirm = await screen.findByRole('alertdialog', {
      name: 'Reset the password of Sara Nyberg?',
    });
    await events.type(
      within(confirm).getByRole('textbox', { name: 'Reason (optional)' }),
      'Forgot it',
    );
    await events.click(within(confirm).getByRole('button', { name: 'Reset password' }));
    expect((await within(confirm).findByRole('alert')).textContent).toBe(
      'Could not reset the password. Check the connection, then try again.',
    );
    await events.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await events.click(button);
    await events.click(await screen.findByRole('menuitem', { name: 'Reset password' }));
    confirm = await screen.findByRole('alertdialog', {
      name: 'Reset the password of Sara Nyberg?',
    });
    expect(
      (within(confirm).getByRole('textbox', { name: 'Reason (optional)' }) as HTMLTextAreaElement)
        .value,
    ).toBe('');
    expect(within(confirm).queryByRole('alert')).toBeNull();
  });

  it('E05-S08 the Role and Status filters narrow the list and live in the URL', async () => {
    const events = userEvent.setup();
    const router = renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.role:read']),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      usersQuery([user(anna, [], true), user(sara, [assignment(shiftLead, plantA)])]),
      usersQuery([user(sara, [assignment(shiftLead, plantA)])], undefined, undefined, {
        roleId: shiftLead.id,
      }),
      usersQuery([], undefined, undefined, { roleId: shiftLead.id, blocked: true }),
    ]);
    const table = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));

    await events.click(await screen.findByRole('button', { name: 'Role' }));
    await events.click(await screen.findByRole('menuitemradio', { name: 'Shift lead' }));
    await waitFor(() => expect(bodyRows(table).map(([name]) => name)).toEqual(['Sara Nyberg']));
    expect(router.state.location.search).toEqual({ role: shiftLead.id });
    expect(screen.getByRole('button', { name: 'Role: Shift lead' })).toBeDefined();

    await events.click(screen.getByRole('button', { name: 'Status' }));
    await events.click(await screen.findByRole('menuitemradio', { name: 'Blocked' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ role: shiftLead.id, status: 'blocked' }),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'No users match these filters' }),
    ).toBeDefined();
  });

  it('E05-S08 Name sorts ascending by default, and Username sorts the list either way, kept in the URL', async () => {
    const events = userEvent.setup();
    const router = renderCoreAt(coreLinks.settings.users({ companyId }).href, [
      settingsViewerQuery(['core.user:read']),
      companiesQuery(),
      usersQuery([user(anna, []), user(sara, [])]),
      usersQuery([user(sara, []), user(anna, [])], undefined, undefined, {
        orderBy: [{ field: 'USERNAME', direction: 'ASC' }],
      }),
      usersQuery([user(anna, []), user(sara, [])], undefined, undefined, {
        orderBy: [{ field: 'USERNAME', direction: 'DESC' }],
      }),
    ]);
    const table = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    const header = (name: string) =>
      within(table).getByRole('columnheader', { name: new RegExp(`^${name}`) });
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending');

    await events.click(within(header('Username')).getByRole('button'));
    await waitFor(() =>
      expect(bodyRows(table).map(([name]) => name)).toEqual(['Sara Nyberg', 'Anna Berg']),
    );
    expect(header('Username').getAttribute('aria-sort')).toBe('ascending');
    expect(router.state.location.search).toEqual({ sort: 'username' });
    await events.click(within(header('Username')).getByRole('button'));

    await waitFor(() => expect(router.state.location.search).toEqual({ sort: '-username' }));
    await waitFor(() =>
      expect(bodyRows(table).map(([name]) => name)).toEqual(['Anna Berg', 'Sara Nyberg']),
    );
  });

  it('E05-S08 a URL with a role, a status and a sort opens the list filtered and sorted that way', async () => {
    renderCoreAt(
      `${coreLinks.settings.users({ companyId }).href}?role=${shiftLead.id}&status=active&sort=-name`,
      [
        settingsViewerQuery(['core.user:read', 'core.role:read']),
        companiesQuery(),
        rolesQuery([shiftLead, viewerRole]),
        usersQuery([user(sara, [assignment(shiftLead, plantA)])], undefined, undefined, {
          orderBy: [{ field: 'NAME', direction: 'DESC' }],
          roleId: shiftLead.id,
          blocked: false,
        }),
      ],
    );

    const table = await screen.findByRole('table', { name: 'Users' });
    await waitFor(() => expect(bodyRows(table).map(([name]) => name)).toEqual(['Sara Nyberg']));
    expect(await screen.findByRole('button', { name: 'Role: Shift lead' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Status: Active' })).toBeDefined();
    expect(
      within(table).getByRole('columnheader', { name: /^Name/ }).getAttribute('aria-sort'),
    ).toBe('descending');
  });

  it('E05-S08 New user says the password is temporary and must be replaced at the first sign-in, and sends the optional reason', async () => {
    const events = userEvent.setup();
    const tove = {
      __typename: 'User',
      id: idOf('tove'),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
    } as const;
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            input.username === 't.lindqvist' && input.reason === 'Night shift operator for line 2',
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
    ]);

    await events.type(await screen.findByRole('textbox', { name: 'Name' }), 'Tove Lindqvist');
    const password = screen.getByRole('region', { name: 'Password' });
    expect(password.textContent).toContain(
      'Temporary, shown to you once after you create the user',
    );
    expect(password.textContent).toContain(
      'Tove Lindqvist must choose a new password at the first sign-in.',
    );
    expect(screen.queryByText('A user of Acme AB.')).toBeNull();
    const reason = screen.getByRole('textbox', { name: 'Reason (optional)' });
    expect([reason.getAttribute('placeholder'), reason.getAttribute('maxlength')]).toEqual([
      'Why you create this user',
      '500',
    ]);
    expect(
      screen.getByText(
        "Shown in the user's history. Do not enter personal data. Up to 500 characters.",
      ),
    ).toBeDefined();
    await events.type(field('Username'), 't.lindqvist');
    await events.type(field('Email'), 'tove.lindqvist@example.test');
    await events.type(reason, 'Night shift operator for line 2');
    await events.click(screen.getByRole('button', { name: 'Create user' }));

    expect(
      await screen.findByRole('dialog', { name: 'Temporary password for Tove Lindqvist' }),
    ).toBeDefined();
  });

  it('E05-S08 Create user with an empty username says Enter a username', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
    ]);

    await events.click(await screen.findByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: /^Fix 3 fields/ });
    expect(within(summary).getByRole('link', { name: 'Enter a username.' })).toBeDefined();
  });

  /** A company admin who creates users and assigns roles, holding Viewer's one permission. */
  const creator = [
    'core.user:read',
    'core.user:create',
    'core.role:read',
    'core.roleAssignment:manage',
    'planning.productionOrder:read',
  ];

  /** Types Tove Lindqvist's name, username and email into New user. */
  async function typeTove(events: ReturnType<typeof userEvent.setup>) {
    await events.type(await screen.findByRole('textbox', { name: 'Name' }), 'Tove Lindqvist');
    await events.type(field('Username'), 't.lindqvist');
    await events.type(field('Email'), 'tove.lindqvist@example.test');
  }

  /** Opens the Role combobox of the section and returns its listbox. */
  async function openRoles(
    events: ReturnType<typeof userEvent.setup>,
    section: HTMLElement,
  ): Promise<HTMLElement> {
    await events.click(within(section).getByRole('combobox', { name: 'Role' }));
    return screen.findByRole('listbox');
  }

  /** An option of the Role listbox by the role's name. */
  function roleOption(listbox: HTMLElement, name: string): HTMLElement {
    return within(listbox).getByRole('option', { name: new RegExp(`^${name}`) });
  }

  /** The role the Role combobox of the section shows as chosen. */
  function chosenRole(section: HTMLElement): string {
    return (within(section).getByRole('combobox', { name: 'Role' }) as HTMLInputElement).value;
  }

  it('E05-S08 New user gives the user a first role at the place chosen under Where, with the roles the creator cannot give locked', async () => {
    const events = userEvent.setup();
    const tove = {
      __typename: 'User',
      id: idOf('tove'),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
    } as const;
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            input.username === 't.lindqvist' &&
            input.roleId === viewerRole.id &&
            input.scopeId === plantA.id,
        },
        result: {
          data: {
            coreCreateUser: {
              __typename: 'CreatedUser',
              temporaryPassword: 'fictional-temp-4821',
              user: { ...tove, blocked: false, roleAssignments: [assignment(viewerRole, plantA)] },
            },
          },
        },
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    await typeTove(events);
    await events.click(within(section).getByRole('radio', { name: 'Plant A only' }));
    expect(
      within(section).getByText(
        'Roles that need permissions you do not hold at Plant A stay in the list, with what they need.',
      ),
    ).toBeDefined();
    const roles = await openRoles(events, section);
    expect(roleOption(roles, 'Shift lead').getAttribute('aria-disabled')).toBe('true');
    await events.click(roleOption(roles, 'Viewer'));
    await events.click(screen.getByRole('button', { name: 'Create user' }));

    expect(
      await screen.findByRole('dialog', { name: 'Temporary password for Tove Lindqvist' }),
    ).toBeDefined();
  });

  it('E05-S08 after New user gives a first role, the roles list read before it counts the new holder', async () => {
    const events = userEvent.setup();
    const tove = {
      __typename: 'User',
      id: idOf('tove'),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
    } as const;
    const router = renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            input.roleId === viewerRole.id && input.scopeId === plantA.id,
        },
        result: {
          data: {
            coreCreateUser: {
              __typename: 'CreatedUser',
              temporaryPassword: 'fictional-temp-4821',
              user: {
                ...tove,
                blocked: false,
                roleAssignments: [
                  { ...assignment(viewerRole, plantA), user: { __typename: 'User', id: tove.id } },
                ],
              },
            },
          },
        },
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    await typeTove(events);
    await events.click(within(section).getByRole('radio', { name: 'Plant A only' }));
    await events.click(roleOption(await openRoles(events, section), 'Viewer'));
    await events.click(screen.getByRole('button', { name: 'Create user' }));
    expect(
      await screen.findByRole('dialog', { name: 'Temporary password for Tove Lindqvist' }),
    ).toBeDefined();

    await router.navigate({ to: coreLinks.settings.roles({ companyId }).href });
    const table = await screen.findByRole('table', { name: 'Roles' });
    await waitFor(() =>
      expect(groupedRows(table)[1]?.[1].map((row) => row.slice(0, 4))).toEqual([
        ['Viewer', 'Planning', '1 of 6', '2 people'],
      ]),
    );
  });

  it('E05-S08 a role the server refuses at the place lands on Role with every value kept', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            input.roleId === viewerRole.id && input.scopeId === acme.id,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'You do not hold it.',
              path: ['coreCreateUser'],
              extensions: {
                code: 'FORBIDDEN',
                errorCode: 'core.role_not_held',
                details: { missingPermissions: ['planning.productionOrder:read'] },
              },
            },
          ],
        },
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    await typeTove(events);
    await events.click(within(section).getByRole('radio', { name: 'Acme AB, all plants' }));
    await events.click(roleOption(await openRoles(events, section), 'Viewer'));
    await events.click(screen.getByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to create the user' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByRole('link').textContent).toMatch(
      /^You cannot assign Viewer at Acme AB\./,
    );
    expect(chosenRole(section)).toBe('Viewer');
    expect(field('Name').value).toBe('Tove Lindqvist');
  });

  it('E05-S08 a role chosen with Where left empty lands on Where with the role kept, and New user sends nothing', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
    ]);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    await typeTove(events);
    await events.click(roleOption(await openRoles(events, section), 'Viewer'));
    await events.click(screen.getByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to create the user' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByRole('link').textContent).toBe('Choose where the role applies.');
    expect(chosenRole(section)).toBe('Viewer');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("E05-S08 Where's message describes each choice of Where while it shows", async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
    ]);
    /** The texts that describe the radio, by its aria-describedby. */
    const descriptionOf = (radio: HTMLElement) =>
      (radio.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    await typeTove(events);
    await events.click(roleOption(await openRoles(events, section), 'Viewer'));
    await events.click(screen.getByRole('button', { name: 'Create user' }));
    await screen.findByRole('group', { name: 'Fix 1 field to create the user' });

    expect(within(section).getAllByRole('radio').map(descriptionOf)).toEqual([
      ['Applies at Plant A.', 'Choose where the role applies.'],
      [
        'Applies to every plant of Acme AB, also plants created later.',
        'Choose where the role applies.',
      ],
    ]);
    await events.click(within(section).getByRole('radio', { name: 'Plant A only' }));
    expect(within(section).getAllByRole('radio').map(descriptionOf)).toEqual([
      ['Applies at Plant A.'],
      ['Applies to every plant of Acme AB, also plants created later.'],
    ]);
  });

  it('E05-S08 with the company as the only place, Role locks the roles the creator cannot give there, and a refusal names the company', async () => {
    const events = userEvent.setup();
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      {
        request: { query: CoreCompanies },
        result: {
          data: {
            coreCompanies: [{ __typename: 'Company', id: acme.id, name: 'Acme AB', plants: [] }],
          },
        },
      },
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string> }) =>
            input.roleId === viewerRole.id && input.scopeId === acme.id,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'You do not hold it.',
              path: ['coreCreateUser'],
              extensions: {
                code: 'FORBIDDEN',
                errorCode: 'core.role_not_held',
                details: { missingPermissions: ['planning.productionOrder:read'] },
              },
            },
          ],
        },
      },
    ]);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    expect(within(section).getByText('The role applies at Acme AB.')).toBeDefined();
    expect(
      within(section).getByText(
        'Checked when you add it: you need every permission of the role at Acme AB.',
      ),
    ).toBeDefined();
    await typeTove(events);
    const roles = await openRoles(events, section);
    expect(roleOption(roles, 'Shift lead').getAttribute('aria-disabled')).toBe('true');
    await events.click(roleOption(roles, 'Viewer'));
    await events.click(screen.getByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to create the user' });
    expect(within(summary).getByRole('link').textContent).toMatch(
      /^You cannot assign Viewer at Acme AB\. It includes 1 permission you do not hold at Acme AB/,
    );
  });

  it('E05-S08 a Role typed into and cleared again counts as no role, and New user creates the user without one', async () => {
    const events = userEvent.setup();
    const tove = {
      __typename: 'User',
      id: idOf('tove'),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
    } as const;
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(creator),
      companiesQuery(),
      rolesQuery([shiftLead, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: Record<string, string | undefined> }) =>
            input.username === 't.lindqvist' &&
            input.roleId === undefined &&
            input.scopeId === undefined,
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
    ]);

    const section = await screen.findByRole('region', { name: 'Role and place' });
    await typeTove(events);
    const role = within(section).getByRole('combobox', { name: 'Role' });
    await events.type(role, 'V');
    await events.clear(role);
    await events.keyboard('{Escape}');
    await events.click(screen.getByRole('button', { name: 'Create user' }));

    expect(
      await screen.findByRole('dialog', { name: 'Temporary password for Tove Lindqvist' }),
    ).toBeDefined();
  });

  it('E05-S08 New user shows no Role and place to a creator who may not assign roles', async () => {
    renderCoreAt(coreLinks.settings.users.new({ companyId }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:create']),
      companiesQuery(),
    ]);

    expect(await screen.findByRole('textbox', { name: 'Name' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Role and place' })).toBeNull();
  });
});
