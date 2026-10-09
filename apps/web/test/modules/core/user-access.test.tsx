// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreBlockUser } from '../../../src/modules/core/screens/user/block-user.graphql.ts';
import { CoreRemoveRoleAssignment } from '../../../src/modules/core/screens/user/remove-role-assignment.graphql.ts';
import { CoreUserPermissions } from '../../../src/modules/core/screens/user/user-permissions.graphql.ts';
import {
  acme,
  anna,
  assignment,
  companiesQuery,
  companyAdminRole,
  forbiddenError,
  plantA,
  rolesQuery,
  sara,
  shiftLead,
  user,
  userQuery,
  viewerQuery,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, plant, renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/** Jonas Holm, plant admin: reads users and roles and assigns roles at Plant A, never at Acme AB. */
const plantAdmin = [
  'core.user:read',
  'core.role:read',
  'core.roleAssignment:manage',
  'planning.productionOrder:read',
  'planning.productionOrder:release',
];

const saraOfPage = user(sara, [assignment(viewerRole, acme), assignment(shiftLead, plantA)]);

/** The effective permissions of a user: read and release, with the roles that grant them. */
function permissionsQuery(
  of: { readonly id: string },
  grants: Readonly<Record<string, readonly ReturnType<typeof assignment>[]>>,
): MockLink.MockedResponse {
  return {
    request: { query: CoreUserPermissions, variables: { id: of.id } },
    result: {
      data: {
        coreUser: {
          __typename: 'User',
          id: of.id,
          effectivePermissions: Object.entries(grants).map(([key, grantedBy]) => ({
            __typename: 'EffectivePermission',
            permission: { __typename: 'Permission', key, installed: true },
            grantedBy: grantedBy.map(({ id, scope, role }) => ({
              __typename: 'RoleAssignment',
              id,
              scope,
              role: role === null ? null : { __typename: 'Role', id: role.id, name: role.name },
            })),
          })),
        },
      },
    },
  };
}

const saraGrants = {
  'planning.productionOrder:read': [assignment(viewerRole, acme), assignment(shiftLead, plantA)],
  'planning.productionOrder:release': [assignment(shiftLead, plantA)],
  'planning.autoplan:run': [],
};

const accessHref = coreLinks.users.user({ plant, userId: sara.id }, { tab: 'access' }).href;

describe("a user's access", () => {
  it("E05-S06 the Access tab lists the user's roles per place, with Remove where the reader may remove it and who can elsewhere, and what the user can do at the plant", async () => {
    const user = userEvent.setup();
    renderCoreAt(accessHref, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      userQuery(saraOfPage),
      permissionsQuery(sara, saraGrants),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Sara Nyberg' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Access' }).getAttribute('aria-selected')).toBe('true');
    const roles = await screen.findByRole('table', { name: 'Roles of Sara Nyberg' });
    await waitFor(() =>
      expect(bodyRows(roles)).toEqual([
        ['Viewer', 'Acme AB, all plants', 'A company admin of Acme AB can remove it.'],
        ['Shift lead', 'Plant A', 'Remove'],
      ]),
    );
    expect(screen.getByRole('button', { name: 'Remove Shift lead at Plant A' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Add role' }).getAttribute('href')).toBe(
      coreLinks.users.user.addRole({ plant, userId: sara.id }).href,
    );

    const can = await screen.findByRole('region', { name: 'What Sara Nyberg can do at Plant A' });
    const planning = await within(can).findByRole('table', { name: 'Planning' });
    expect(bodyRows(planning)).toEqual([
      [
        'Read production orders and the planning boardplanning.productionOrder:read',
        'Viewer at Acme AB, Shift lead at Plant A',
      ],
      [
        'Release production orders to the floorplanning.productionOrder:release',
        'Shift lead at Plant A',
      ],
    ]);

    await user.click(within(can).getByRole('checkbox', { name: 'Show every permission' }));

    const every = within(can).getByRole('table', { name: 'Planning 2 of 3' });
    expect(bodyRows(every).at(-1)).toEqual([
      'Run autoplanplanning.autoplan:run',
      'No access. No role of Sara Nyberg at Plant A or at Acme AB includes it.',
    ]);
  });

  it('E05-S06 Remove asks with what the user loses and an optional reason that has focus; Escape returns to Remove, and the confirm removes the role, announces it and moves focus on', async () => {
    const user = userEvent.setup();
    renderCoreAt(accessHref, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      userQuery(saraOfPage),
      permissionsQuery(sara, saraGrants),
      {
        request: {
          query: CoreRemoveRoleAssignment,
          variables: {
            input: { id: assignment(shiftLead, plantA).id, reason: 'Moved to day shift' },
          },
        },
        result: {
          data: {
            coreRemoveRoleAssignment: {
              __typename: 'RoleAssignment',
              id: assignment(shiftLead, plantA).id,
            },
          },
        },
      },
      permissionsQuery(sara, {
        'planning.productionOrder:read': [assignment(viewerRole, acme)],
      }),
    ]);

    const remove = await screen.findByRole('button', { name: 'Remove Shift lead at Plant A' });
    await user.click(remove);
    let dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Shift lead at Plant A from Sara Nyberg?',
    });
    expect(
      within(dialog).getByText(
        'From the next action, Sara Nyberg loses these permissions at Plant A:',
      ),
    ).toBeDefined();
    expect(within(dialog).getByText('Release production orders to the floor')).toBeDefined();
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    await waitFor(() => expect(document.activeElement).toBe(reason));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(remove));

    await user.click(remove);
    dialog = await screen.findByRole('alertdialog');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Reason (optional)' }),
      'Moved to day shift',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remove role' }));

    await waitFor(() =>
      expect(bodyRows(screen.getByRole('table', { name: 'Roles of Sara Nyberg' }))).toEqual([
        ['Viewer', 'Acme AB, all plants', 'A company admin of Acme AB can remove it.'],
      ]),
    );
    await waitFor(() =>
      expect(spoken()).toBe(
        "Shift lead at Plant A removed from Sara Nyberg. It applies from Sara Nyberg's next action.",
      ),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Add role' })),
    );
  });

  it("E05-S06 Remove of a company role names what a plant role keeps only at that plant as lost, since the company's other plants keep only what other company roles grant", async () => {
    const user = userEvent.setup();
    const companyAdmin = [...plantAdmin, 'core.roleAssignment:manage'];
    renderCoreAt(accessHref, [
      viewerQuery(companyAdmin, companyAdmin),
      companiesQuery(),
      userQuery(saraOfPage),
      permissionsQuery(sara, saraGrants),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Remove Viewer at Acme AB' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Viewer at Acme AB from Sara Nyberg?',
    });

    expect(
      within(dialog).getByText(
        'From the next action, Sara Nyberg loses these permissions at Acme AB:',
      ),
    ).toBeDefined();
    expect(within(dialog).getByText('Read production orders and the planning board')).toBeDefined();
    expect(within(dialog).queryByText(/keeps every permission/)).toBeNull();
  });

  it("E05-S06 Remove of a company's last active Company admin is refused: the dialog shows the server's message and the role stays", async () => {
    const pointer = userEvent.setup();
    const all = [...companyAdminRole.permissions];
    const saraAdmin = user(sara, [assignment(companyAdminRole, acme)]);
    const message =
      'Sara Nyberg is the last active Company admin of Acme AB, so Company admin cannot be removed from them. Give Company admin at Acme AB to someone else first.';
    renderCoreAt(accessHref, [
      viewerQuery(all, all),
      companiesQuery(),
      userQuery(saraAdmin),
      permissionsQuery(sara, {}),
      {
        request: {
          query: CoreRemoveRoleAssignment,
          variables: { input: { id: assignment(companyAdminRole, acme).id } },
        },
        result: {
          errors: [
            {
              message,
              path: ['coreRemoveRoleAssignment'],
              extensions: { code: 'PRECONDITION', errorCode: 'core.last_admin' },
            },
          ],
        },
      },
    ]);

    await pointer.click(
      await screen.findByRole('button', { name: 'Remove Company admin at Acme AB' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await pointer.click(within(dialog).getByRole('button', { name: 'Remove role' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      `Could not remove the role. ${message}`,
    );
    await pointer.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(bodyRows(screen.getByRole('table', { name: 'Roles of Sara Nyberg' }))).toEqual([
      ['Company admin', 'Acme AB, all plants', 'Remove'],
    ]);
  });

  it('E05-S06 after Remove, the roles list read before it no longer counts the holder', async () => {
    const user = userEvent.setup();
    // Sara Nyberg's assignment is the same row in the role's holders and in her roles.
    const shiftLeadHeld = {
      ...shiftLead,
      holders: shiftLead.holders.map((holder) =>
        holder.user.id === sara.id ? { ...holder, id: assignment(shiftLead, plantA).id } : holder,
      ),
    };
    const router = renderCoreAt(coreLinks.roles({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      rolesQuery([shiftLeadHeld, viewerRole]),
      userQuery(saraOfPage),
      permissionsQuery(sara, saraGrants),
      {
        request: {
          query: CoreRemoveRoleAssignment,
          variables: { input: { id: assignment(shiftLead, plantA).id } },
        },
        result: {
          data: {
            coreRemoveRoleAssignment: {
              __typename: 'RoleAssignment',
              id: assignment(shiftLead, plantA).id,
            },
          },
        },
      },
      permissionsQuery(sara, { 'planning.productionOrder:read': [assignment(viewerRole, acme)] }),
    ]);

    const custom = await screen.findByRole('table', { name: 'Custom roles of Acme AB' });
    await waitFor(() => expect(bodyRows(custom)).toEqual([['Shift lead', 'Acme AB', '2', '2']]));
    await router.navigate({ to: accessHref });
    await user.click(await screen.findByRole('button', { name: 'Remove Shift lead at Plant A' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove role' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await router.navigate({ to: coreLinks.roles({ plant }).href });

    await waitFor(() =>
      expect(bodyRows(screen.getByRole('table', { name: 'Custom roles of Acme AB' }))).toEqual([
        ['Shift lead', 'Acme AB', '2', '1'],
      ]),
    );
  });

  it('E05-S06 a user without a role: the Roles card says so and keeps Add role, and the permissions come from roles', async () => {
    const lena = { ...anna, name: 'Lena Ek' };
    renderCoreAt(coreLinks.users.user({ plant, userId: lena.id }, { tab: 'access' }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      userQuery(user(lena, [])),
      permissionsQuery(lena, { 'planning.productionOrder:read': [] }),
    ]);

    expect(
      await screen.findByText('Lena Ek holds no role at Plant A or at Acme AB.'),
    ).toBeDefined();
    expect(await screen.findByRole('link', { name: 'Add role' })).toBeDefined();
    expect(await screen.findByText('Permissions come from roles. Add a role above.')).toBeDefined();
  });

  it('E05-S06 a reader without core.role:read sees No access in each Role cell, Remove named by the place, no Add role, and the permissions region denied with what it needs', async () => {
    const pointer = userEvent.setup();
    renderCoreAt(accessHref, [
      viewerQuery(['core.user:read', 'core.roleAssignment:manage']),
      companiesQuery(),
      userQuery(user(sara, [assignment(null, acme), assignment(null, plantA)]), [
        forbiddenError(['coreUser', 'roleAssignments', 0, 'role']),
        forbiddenError(['coreUser', 'roleAssignments', 1, 'role']),
      ]),
      {
        request: { query: CoreUserPermissions, variables: { id: sara.id } },
        result: {
          data: { coreUser: null },
          errors: [forbiddenError(['coreUser', 'effectivePermissions'])],
        },
      },
    ]);

    const roles = await screen.findByRole('table', { name: 'Roles of Sara Nyberg' });
    await waitFor(() =>
      expect(bodyRows(roles).map(([role]) => role)).toEqual([
        'No access. Roles need the permission to read roles (core.role:read) at Plant A.',
        'No access. Roles need the permission to read roles (core.role:read) at Plant A.',
      ]),
    );
    // Remove shows once the reader's permissions arrived, so Add role would show by then too.
    expect(await screen.findByRole('button', { name: 'Remove role at Plant A' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Add role' })).toBeNull();
    const can = screen.getByRole('region', { name: 'What Sara Nyberg can do at Plant A' });
    expect(
      await within(can).findByRole('heading', {
        level: 3,
        name: 'You cannot see what Sara Nyberg can do here',
      }),
    ).toBeDefined();
    expect(
      within(can).getByText('This needs the permission to read roles (core.role:read) at Plant A.'),
    ).toBeDefined();

    // The reader cannot see the role, so the dialog does not claim what the user keeps.
    await pointer.click(screen.getByRole('button', { name: 'Remove role at Plant A' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove a role at Plant A from Sara Nyberg?',
    });
    expect(
      within(dialog).getByText(
        'From the next action, Sara Nyberg loses the permissions of this role at Plant A that no other role grants.',
      ),
    ).toBeDefined();
    expect(within(dialog).queryByText(/keeps every permission/)).toBeNull();
  });

  it('E05-S08 Block user needs core.user:block at the company: a plant admin who holds it at Plant A only gets no Block user', async () => {
    renderCoreAt(accessHref, [
      viewerQuery([...plantAdmin, 'core.user:block']),
      companiesQuery(),
      userQuery(saraOfPage),
      permissionsQuery(sara, saraGrants),
    ]);

    // Remove shows once the reader's permissions arrived, so Block user would show by then too.
    expect(
      await screen.findByRole('button', { name: 'Remove Shift lead at Plant A' }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Block user' })).toBeNull();
  });

  it('E05-S08 Block user asks with an optional reason that has focus, then Unblock user takes its place and focus, and the polite region says what changed', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.users.user({ plant, userId: sara.id }).href, [
      viewerQuery(['core.user:read', 'core.user:block'], ['core.user:block']),
      companiesQuery(),
      userQuery(saraOfPage),
      {
        request: {
          query: CoreBlockUser,
          variables: { input: { id: sara.id, reason: 'Left the company' } },
        },
        result: { data: { coreBlockUser: { __typename: 'User', id: sara.id, blocked: true } } },
      },
    ]);

    expect((await screen.findAllByText('Active', { selector: '[data-tone]' })).length).toBe(2);
    await user.click(await screen.findByRole('button', { name: 'Block user' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Block Sara Nyberg?' });
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    await waitFor(() => expect(document.activeElement).toBe(reason));
    await user.type(reason, 'Left the company');
    await user.click(within(dialog).getByRole('button', { name: 'Block user' }));

    const unblock = await screen.findByRole('button', { name: 'Unblock user' });
    await waitFor(() => expect(document.activeElement).toBe(unblock));
    expect(screen.getAllByText('Blocked', { selector: '[data-tone]' })).toHaveLength(2);
    await waitFor(() =>
      expect(spoken()).toBe('Sara Nyberg is blocked and signed out within a minute.'),
    );
  });
});
