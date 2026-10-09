// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreRemoveRoleAssignment } from '../../../src/modules/core/components/remove-role/remove-role-assignment.graphql.ts';
import { CoreBlockUser } from '../../../src/modules/core/screens/user/block-user.graphql.ts';
import { CoreUserPermissions } from '../../../src/modules/core/screens/user/user-permissions.graphql.ts';
import {
  acme,
  anna,
  assignment,
  catalogQuery,
  companiesQuery,
  companyAdminRole,
  companyId,
  forbiddenError,
  groupedRows,
  plantA,
  rolesQuery,
  sara,
  settingsViewerQuery,
  setViewport,
  shiftLead,
  user,
  userQuery,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/**
 * Jonas Holm reads users and roles and assigns roles at Acme AB, and holds the planning permissions
 * there, so at every plant of it.
 */
const assigner = [
  'core.user:read',
  'core.role:read',
  'core.roleAssignment:manage',
  'planning.productionOrder:read',
  'planning.productionOrder:release',
];

/** Karin Dahl assigns roles at Acme AB but cannot release production orders there. */
const reader = [
  'core.user:read',
  'core.role:read',
  'core.roleAssignment:manage',
  'planning.productionOrder:read',
];

const saraOfPage = user(sara, [assignment(viewerRole, acme), assignment(shiftLead, plantA)]);

/** The effective permissions of a user: read and release, with the roles that grant them. */
function permissionsQuery(
  of: { readonly id: string },
  grants: Readonly<Record<string, readonly ReturnType<typeof assignment>[]>>,
): MockLink.MockedResponse {
  return {
    request: { query: CoreUserPermissions, variables: { id: of.id, companyId } },
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

/** What Sara Nyberg can do at Acme AB: her role at a plant grants nothing at the company. */
const saraGrants = {
  'planning.productionOrder:read': [assignment(viewerRole, acme)],
  'planning.productionOrder:release': [],
  'planning.autoplan:run': [],
};

const accessHref = coreLinks.settings.users.user(
  { companyId, userId: sara.id },
  { tab: 'access' },
).href;

describe("a user's access", () => {
  it("E04-S02 the Access tab in company settings lists the user's roles at the company and its plants, with Remove where the reader may remove it, and what the user can do at the company", async () => {
    const user = userEvent.setup();
    renderCoreAt(accessHref, [
      settingsViewerQuery(reader),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
      permissionsQuery(sara, saraGrants),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Sara Nyberg' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Access' }).getAttribute('aria-selected')).toBe('true');
    const roles = await screen.findByRole('table', { name: 'Roles of Sara Nyberg' });
    await waitFor(() =>
      expect(bodyRows(roles)).toEqual([
        ['Shift leadCustom role', 'Plant A', ''],
        ['ViewerPlanning, default role', 'Acme AB, all plants', 'Remove'],
      ]),
    );
    // Shift lead includes Release, which the reader does not hold, so the reader cannot remove it.
    expect(screen.getByRole('button', { name: 'Remove Viewer at Acme AB' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Remove Shift lead at Plant A' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Add role' }).getAttribute('href')).toBe(
      coreLinks.settings.users.user.addRole({ companyId, userId: sara.id }).href,
    );

    const can = await screen.findByRole('region', { name: 'What Sara Nyberg can do at Acme AB' });
    expect(
      within(can).getByText(
        "Every permission of the roles above, by module. A change applies from Sara Nyberg's next action.",
      ),
    ).toBeDefined();
    const permissions = await within(can).findByRole('table', {
      name: 'What Sara Nyberg can do at Acme AB',
    });
    expect(groupedRows(permissions)).toEqual([
      [
        'Planning',
        [
          [
            'Read production orders and the planning boardplanning.productionOrder:read',
            'Viewer at Acme AB',
          ],
        ],
      ],
    ]);
    expect(
      within(permissions)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Planning1']);

    await user.click(within(can).getByRole('checkbox', { name: 'Show every permission' }));

    expect(
      within(permissions)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Planning1 of 3']);
    expect(groupedRows(permissions)[0]?.[1].at(-1)).toEqual([
      'Run autoplanplanning.autoplan:run',
      'No access. No role of Sara Nyberg at Acme AB includes it.',
    ]);
  });

  it('E05-S06 Remove asks with what the user loses and an optional reason that has focus; Escape returns to Remove, and the confirm removes the role, announces it and moves focus on', async () => {
    const user = userEvent.setup();
    renderCoreAt(accessHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
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
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Release production orders to the floor']);
    expect(
      within(dialog).getByText(
        'Viewer at Acme AB still lets Sara Nyberg read production orders and the planning board.',
      ),
    ).toBeDefined();
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    expect(reason.getAttribute('placeholder')).toBe('Why you remove this role');
    expect(
      within(dialog).getByText(
        "Shown in the user's history. Do not enter personal data. Up to 500 characters.",
      ),
    ).toBeDefined();
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
        ['ViewerPlanning, default role', 'Acme AB, all plants', 'Remove'],
      ]),
    );
    await waitFor(() =>
      expect(spoken()).toBe(
        "Shift lead at Plant A removed from Sara Nyberg. It applies from Sara Nyberg's next action.",
      ),
    );
    // Focus moves to the next row's role link (NO24).
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Viewer' })),
    );
  });

  it("E05-S06 Remove of a company role names what a plant role keeps only at that plant as lost, since the company's other plants keep only what other company roles grant", async () => {
    const user = userEvent.setup();
    renderCoreAt(accessHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
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
    // Shift lead at Plant A keeps the permission at Plant A only, not at the other plants.
    expect(within(dialog).queryByText(/still lets/)).toBeNull();
  });

  it("E05-S06 Remove of a company's last active Company admin is refused: the dialog says why and what to do, in its own words, and the role stays", async () => {
    const pointer = userEvent.setup();
    const all = [...companyAdminRole.permissions];
    const saraAdmin = user(sara, [assignment(companyAdminRole, acme)]);
    const message =
      'Sara Nyberg is the last active Company admin of Acme AB, so Company admin cannot be removed from them. Give Company admin at Acme AB to someone else first.';
    renderCoreAt(accessHref, [
      settingsViewerQuery(all),
      companiesQuery(),
      userQuery(saraAdmin),
      rolesQuery([companyAdminRole]),
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
      'You cannot remove Company admin at Acme AB from Sara Nyberg, the last Company admin of Acme AB. Give Company admin at Acme AB to another person first.',
    );
    await pointer.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(bodyRows(screen.getByRole('table', { name: 'Roles of Sara Nyberg' }))).toEqual([
      ['Company adminCore, default role', 'Acme AB, all plants', 'Remove'],
    ]);
  });

  it('E05-S06 a Remove the API refuses for the assignment permission or the grant rule names the place and who can act, never the server text', async () => {
    const pointer = userEvent.setup();
    const refusal = (errorCode: string, details?: Record<string, unknown>) => ({
      request: {
        query: CoreRemoveRoleAssignment,
        variables: { input: { id: assignment(shiftLead, plantA).id } },
      },
      result: {
        errors: [
          {
            message: 'server text',
            path: ['coreRemoveRoleAssignment'],
            extensions: { code: 'FORBIDDEN', errorCode, ...(details && { details }) },
          },
        ],
      },
    });
    renderCoreAt(accessHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
      permissionsQuery(sara, saraGrants),
      refusal('core.forbidden'),
      refusal('core.role_not_held', {
        scopeId: plantA.id,
        missingPermissions: ['planning.productionOrder:release'],
      }),
    ]);

    await pointer.click(
      await screen.findByRole('button', { name: 'Remove Shift lead at Plant A' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    await pointer.click(within(dialog).getByRole('button', { name: 'Remove role' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'You cannot remove Shift lead at Plant A. Removing a role at Plant A needs the permission to assign and remove roles (core.roleAssignment:manage) there. Ask a company admin of Acme AB to remove it.',
    );
    await pointer.click(within(dialog).getByRole('button', { name: 'Remove role' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'You cannot remove Shift lead at Plant A. It includes 1 permission you do not hold at Plant A: Release production orders to the floor (planning.productionOrder:release). Ask a company admin of Acme AB to remove it.',
      ),
    );
    expect(within(dialog).queryByText(/server text/)).toBeNull();
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
    const router = renderCoreAt(coreLinks.settings.roles({ companyId }).href, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      rolesQuery([shiftLeadHeld, viewerRole]),
      catalogQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
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

    const roles = await screen.findByRole('table', { name: 'Roles' });
    await waitFor(() =>
      expect(groupedRows(roles)[0]?.[1].map((row) => row.slice(0, 4))).toEqual([
        ['Shift lead', 'Acme AB', '2 of 6', '2 people'],
      ]),
    );
    await router.navigate({ to: accessHref });
    await user.click(await screen.findByRole('button', { name: 'Remove Shift lead at Plant A' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove role' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await router.navigate({ to: coreLinks.settings.roles({ companyId }).href });

    await waitFor(() =>
      expect(
        groupedRows(screen.getByRole('table', { name: 'Roles' }))[0]?.[1].map((row) =>
          row.slice(0, 4),
        ),
      ).toEqual([['Shift lead', 'Acme AB', '2 of 6', '1 person']]),
    );
  });

  it('E05-S06 a user without a role: the Roles card says so and keeps Add role, and the permissions come from roles', async () => {
    const lena = { ...anna, name: 'Lena Ek' };
    renderCoreAt(
      coreLinks.settings.users.user({ companyId, userId: lena.id }, { tab: 'access' }).href,
      [
        settingsViewerQuery(assigner),
        companiesQuery(),
        userQuery(user(lena, [])),
        permissionsQuery(lena, { 'planning.productionOrder:read': [] }),
      ],
    );

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Lena Ek holds no role at Acme AB or its plants.',
      }),
    ).toBeDefined();
    expect(
      screen.getByText('Add a role so that Lena Ek can work at Acme AB and its plants.'),
    ).toBeDefined();
    expect(await screen.findByRole('link', { name: 'Add role' })).toBeDefined();
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Lena Ek can do nothing at Acme AB yet.',
      }),
    ).toBeDefined();
    expect(screen.getByText('Permissions come from roles. Add a role above.')).toBeDefined();
  });

  it('E05-S06 what the user can do failed to load: the card shows the error with the correlation id, and Try again keeps focus and loads it', async () => {
    const pointer = userEvent.setup();
    renderCoreAt(accessHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
      {
        request: { query: CoreUserPermissions, variables: { id: sara.id, companyId } },
        result: {
          data: null,
          errors: [
            {
              message: 'x',
              path: ['coreUser'],
              extensions: { code: 'INTERNAL_SERVER_ERROR', correlationId: 'c0ffee12' },
            },
          ],
        },
      },
      permissionsQuery(sara, saraGrants),
    ]);

    const can = await screen.findByRole('region', { name: 'What Sara Nyberg can do at Acme AB' });
    expect(
      await within(can).findByRole('heading', { name: 'Could not load what Sara Nyberg can do' }),
    ).toBeDefined();
    const retry = within(can).getByRole('button', { name: 'Try again' });
    await pointer.click(retry);
    expect(
      await within(can).findByRole('table', { name: 'What Sara Nyberg can do at Acme AB' }),
    ).toBeDefined();
  });

  it('E05-S06 at 320 px each role is a card with its kind, its place and Remove or who can remove it (NO13)', async () => {
    setViewport(320, 640);
    try {
      renderCoreAt(accessHref, [
        settingsViewerQuery(reader),
        companiesQuery(),
        userQuery(saraOfPage),
        rolesQuery([shiftLead, viewerRole]),
      rolesQuery([shiftLead, viewerRole]),
        permissionsQuery(sara, saraGrants),
      ]);

      const list = await screen.findByRole('list', { name: 'Roles of Sara Nyberg' });
      await waitFor(() =>
        expect(
          within(list)
            .getAllByRole('listitem')
            .map((item) => item.textContent),
        ).toEqual([
          'Shift leadCustom rolePlant A',
          'ViewerPlanning, default roleAcme AB, all plantsRemove',
        ]),
      );
      expect(screen.queryByRole('table', { name: 'Roles of Sara Nyberg' })).toBeNull();
    } finally {
      setViewport(1440, 900);
    }
  });

  it('E05-S06 a reader without core.role:read sees No access in each Role cell, Remove named by the place, no Add role, and the permissions region denied with what it needs', async () => {
    const pointer = userEvent.setup();
    renderCoreAt(accessHref, [
      settingsViewerQuery(['core.user:read', 'core.roleAssignment:manage']),
      companiesQuery(),
      userQuery(user(sara, [assignment(null, acme), assignment(null, plantA)]), [
        forbiddenError(['coreUser', 'roleAssignments', 0, 'role']),
        forbiddenError(['coreUser', 'roleAssignments', 1, 'role']),
      ]),
      {
        request: { query: CoreUserPermissions, variables: { id: sara.id, companyId } },
        result: {
          data: { coreUser: null },
          errors: [forbiddenError(['coreUser', 'effectivePermissions'])],
        },
      },
    ]);

    const roles = await screen.findByRole('table', { name: 'Roles of Sara Nyberg' });
    await waitFor(() =>
      expect(bodyRows(roles).map(([role]) => role)).toEqual([
        'No access. Roles need the permission to read roles (core.role:read) at Acme AB.',
        'No access. Roles need the permission to read roles (core.role:read) at Acme AB.',
      ]),
    );
    // Remove shows once the reader's permissions arrived, so Add role would show by then too.
    expect(await screen.findByRole('button', { name: 'Remove role at Plant A' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Add role' })).toBeNull();
    const can = screen.getByRole('region', { name: 'What Sara Nyberg can do at Acme AB' });
    expect(
      await within(can).findByRole('heading', {
        level: 3,
        name: 'You cannot see what Sara Nyberg can do here',
      }),
    ).toBeDefined();
    expect(
      within(can).getByText('This needs the permission to read roles (core.role:read) at Acme AB.'),
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

  it('E05-S08 Block user needs core.user:block at the company: a reader without it gets no Block user', async () => {
    renderCoreAt(accessHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
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
    renderCoreAt(coreLinks.settings.users.user({ companyId, userId: sara.id }).href, [
      settingsViewerQuery(['core.user:read', 'core.user:block']),
      companiesQuery(),
      userQuery(saraOfPage),
      rolesQuery([shiftLead, viewerRole]),
      {
        request: {
          query: CoreBlockUser,
          variables: { input: { id: sara.id, companyId, reason: 'Left the company' } },
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
