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
  forbiddenError,
  idOf,
  plantA,
  sara,
  shiftLead,
  user,
  viewerQuery,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, plant, renderCoreAt } from './core-app.tsx';

afterEach(cleanup);

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** coreUsers' first page with these users. */
function usersQuery(nodes: readonly ReturnType<typeof user>[]): MockLink.MockedResponse {
  return {
    request: { query: CoreUsers, variables: { first: 25 } },
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
  it('E05-S08 the users list shows each user with their username, their roles per place and their status, and New user for a user who may create users', async () => {
    renderCoreAt(coreLinks.users({ plant }).href, [
      viewerQuery(['core.user:read', 'core.user:create'], ['core.user:create']),
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
        ['Sara Nyberg', 's.nyberg', 'Viewer · Acme ABShift lead · Plant A', 'Active'],
      ]),
    );
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole('columnheader')
          .map((header) => header.textContent),
      ).toEqual(['Name', 'Username', 'Roles at Acme AB and Plant A', 'Status']),
    );
    expect(screen.getByRole('link', { name: 'Sara Nyberg' }).getAttribute('href')).toBe(
      coreLinks.users.user({ plant, userId: sara.id }).href,
    );
    expect((await screen.findByRole('link', { name: 'New user' })).getAttribute('href')).toBe(
      coreLinks.users.new({ plant }).href,
    );
  });

  it('E05-S08 a reader without core.user:read gets the page No access to Users', async () => {
    renderCoreAt(coreLinks.users({ plant }).href, [
      viewerQuery([]),
      companiesQuery(),
      {
        request: { query: CoreUsers, variables: { first: 25 } },
        result: { data: null, errors: [forbiddenError(['coreUsers'])] },
      },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to Users' }),
    ).toBeDefined();
    expect(
      await screen.findByText(
        'Opening Users needs the permission to read users and their roles (core.user:read) at Plant A. Ask a plant admin for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('E05-S08 New user needs core.user:create at the company: a plant admin who holds it at Plant A only gets the page No access to New user, and the list shows no New user', async () => {
    const router = renderCoreAt(coreLinks.users.new({ plant }).href, [
      viewerQuery(['core.user:read', 'core.user:create']),
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

    await router.navigate({ to: coreLinks.users({ plant }).href });
    expect(await screen.findByRole('link', { name: 'Sara Nyberg' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'New user' })).toBeNull();
  });

  it('E05-S08 Create user with empty fields shows each message in the summary, which takes focus, and sends nothing', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.users.new({ plant }).href, [
      viewerQuery(['core.user:read', 'core.user:create'], ['core.user:create']),
      companiesQuery(),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 2 fields to create the user' });
    expect(document.activeElement).toBe(summary);
    expect(field('Username').getAttribute('aria-invalid')).toBe('true');
    expect(field('Name').getAttribute('aria-invalid')).toBe('true');
  });

  it('E05-S08 a username that is taken or was used before lands on Username with the typed values kept', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.users.new({ plant }).href, [
      viewerQuery(['core.user:read', 'core.user:create'], ['core.user:create']),
      companiesQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: { id: string; name: string; username: string } }) =>
            uuidv7.test(input.id) &&
            input.name === 'Tove Lindqvist' &&
            input.username === 't.lindqvist',
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
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to create the user' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByRole('link').textContent).toBe(
      'The username t.lindqvist is taken or was used before. Choose another username.',
    );
    expect(field('Username').value).toBe('t.lindqvist');
    expect(field('Name').value).toBe('Tove Lindqvist');
  });

  it("E05-S08 a created user's page replaces the form and shows the temporary password once, with focus on Copy password; Done closes it and focus goes to the h1", async () => {
    const user = userEvent.setup();
    const tove = {
      __typename: 'User',
      id: idOf('tove'),
      name: 'Tove Lindqvist',
      username: 't.lindqvist',
    } as const;
    const router = renderCoreAt(coreLinks.users.new({ plant }).href, [
      viewerQuery(['core.user:read', 'core.user:create'], ['core.user:create']),
      companiesQuery(),
      {
        request: {
          query: CoreCreateUser,
          variables: ({ input }: { input: { id: string; name: string; username: string } }) =>
            uuidv7.test(input.id) &&
            input.name === 'Tove Lindqvist' &&
            input.username === 't.lindqvist',
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
        request: { query: CoreUserPermissions, variables: { id: tove.id } },
        result: {
          data: { coreUser: { __typename: 'User', id: tove.id, effectivePermissions: [] } },
        },
      },
    ]);

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Tove Lindqvist');
    await user.type(field('Username'), 'T.Lindqvist');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Temporary password for Tove Lindqvist',
    });
    expect(router.state.location.pathname).toBe(
      coreLinks.users.user({ plant, userId: tove.id }).href,
    );
    expect(
      (within(dialog).getByRole('textbox', { name: 'Temporary password' }) as HTMLInputElement)
        .value,
    ).toBe('fictional-temp-4821');
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
