// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreAssignRole } from '../../../src/modules/core/components/assign-role-form/assign-role.graphql.ts';
import { CoreRemoveRoleAssignment } from '../../../src/modules/core/components/remove-role/remove-role-assignment.graphql.ts';
import { CorePlantRoleAssignments } from '../../../src/modules/core/screens/people/plant-role-assignments.graphql.ts';
import { CoreUsers } from '../../../src/modules/core/screens/people-add-role/users.graphql.ts';
import { CoreUserPermissions } from '../../../src/modules/core/screens/user/user-permissions.graphql.ts';
import { CoreUser } from '../../../src/modules/core/user.graphql.ts';
import {
  acme,
  anna,
  assignment,
  companiesQuery,
  companyAdminRole,
  forbiddenError,
  person,
  planner,
  plantA,
  plantAdminRole,
  rolesQuery,
  sara,
  shiftLead,
  user as userOf,
  userQuery,
  viewerQuery,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, plant, renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/** Erik Lind, Plant admin of Plant A: every permission there but the company-level ones. */
const plantAdmin = [...plantAdminRole.permissions];

/** A role at Plant A as corePlantRoleAssignments lists it, with its holder. */
function heldAtPlant(of: Parameters<typeof assignment>[0], who: typeof sara) {
  return { ...assignment(of, plantA, `${assignment(of, plantA).id}-${who.username}`), user: who };
}

const saraLead = heldAtPlant(shiftLead, sara);
const annaViewer = heldAtPlant(viewerRole, anna);

/** corePlantRoleAssignments with these assignments, in the API's order, by the holder's name. */
function peopleQuery(
  assignments: readonly ReturnType<typeof heldAtPlant>[],
): MockLink.MockedResponse {
  return {
    request: { query: CorePlantRoleAssignments },
    result: { data: { corePlantRoleAssignments: assignments } },
  };
}

/** coreUsers of the plant's company, the people Add role offers. */
function companyUsersQuery(
  people: readonly { readonly id: string; readonly name: string; readonly username: string }[],
  search?: string,
): MockLink.MockedResponse {
  return {
    request: { query: CoreUsers, variables: search === undefined ? {} : { search } },
    result: {
      data: {
        coreUsers: {
          __typename: 'UserConnection',
          edges: people.map((node) => ({
            __typename: 'UserEdge',
            node: { blocked: false, ...node },
          })),
        },
      },
    },
  };
}

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('People in plant settings', () => {
  it('E04-S02 People lists who holds a role at the plant, by name, with Remove at this plant where the plant admin may remove it, and Add role', async () => {
    renderCoreAt(coreLinks.people({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      peopleQuery([annaViewer, saraLead]),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'People' })).toBeDefined();
    const table = await screen.findByRole('table', { name: 'People at Plant A' });
    await waitFor(() =>
      expect(bodyRows(table)).toEqual([
        ['Anna Berg', 'a.berg', 'Viewer', 'Remove'],
        ['Sara Nyberg', 's.nyberg', 'Shift lead', 'Remove'],
      ]),
    );
    expect(
      screen.getByRole('button', { name: 'Remove Shift lead at Plant A from Sara Nyberg' }),
    ).toBeDefined();
    expect((await screen.findByRole('link', { name: 'Add role' })).getAttribute('href')).toBe(
      coreLinks.people.addRole({ plant }).href,
    );
    expect(
      screen.getByText(
        'Who holds a role at Plant A. Roles that apply at every plant of Acme AB are given in company settings.',
      ),
    ).toBeDefined();
  });

  it('E04-S02 a role whose permissions the plant admin does not hold at the plant has no Remove', async () => {
    renderCoreAt(coreLinks.people({ plant }).href, [
      viewerQuery(['core.user:read', 'core.role:read', 'core.roleAssignment:manage']),
      companiesQuery(),
      peopleQuery([saraLead]),
    ]);

    const table = await screen.findByRole('table', { name: 'People at Plant A' });
    await waitFor(() =>
      expect(bodyRows(table)).toEqual([['Sara Nyberg', 's.nyberg', 'Shift lead', '']]),
    );
  });

  it('E04-S02 Remove at this plant asks with an optional reason, removes the role, announces it and moves focus to the next row', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.people({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      peopleQuery([annaViewer, saraLead]),
      {
        request: {
          query: CoreRemoveRoleAssignment,
          variables: { input: { id: annaViewer.id } },
        },
        result: {
          data: {
            coreRemoveRoleAssignment: { __typename: 'RoleAssignment', id: annaViewer.id },
          },
        },
      },
    ]);

    await user.click(
      await screen.findByRole('button', { name: 'Remove Viewer at Plant A from Anna Berg' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Viewer at Plant A from Anna Berg?',
    });
    expect(
      within(dialog).getByText(
        'From the next action, Anna Berg loses the permissions of this role at Plant A that no other role grants.',
      ),
    ).toBeDefined();
    const reason = within(dialog).getByRole('textbox', { name: 'Reason (optional)' });
    expect(reason.getAttribute('placeholder')).toBe('Why you remove this role');
    expect(reason.getAttribute('maxlength')).toBe('500');
    expect(
      within(dialog).getByText(
        "Shown in the user's history. Do not enter personal data. Up to 500 characters.",
      ),
    ).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Remove role' }));

    await waitFor(() =>
      expect(bodyRows(screen.getByRole('table', { name: 'People at Plant A' }))).toEqual([
        ['Sara Nyberg', 's.nyberg', 'Shift lead', 'Remove'],
      ]),
    );
    await waitFor(() =>
      expect(spoken()).toBe(
        "Viewer at Plant A removed from Anna Berg. It applies from Anna Berg's next action.",
      ),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Remove Shift lead at Plant A from Sara Nyberg' }),
      ),
    );
  });

  it("E04-S02 Remove at this plant names what the person loses there and what the person's other roles keep, read from the person's roles", async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.people({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      peopleQuery([annaViewer, saraLead]),
      userQuery(
        userOf(sara, [assignment(viewerRole, acme), assignment(shiftLead, plantA, saraLead.id)]),
      ),
    ]);

    await user.click(
      await screen.findByRole('button', { name: 'Remove Shift lead at Plant A from Sara Nyberg' }),
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(
      await within(dialog).findByText(
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
  });

  it('E04-S02 Add role gives a person of the company a role at the plant, locks the roles the plant admin cannot give there, and returns to People', async () => {
    const user = userEvent.setup();
    const given = { ...heldAtPlant(planner, anna), id: '019a0000-0000-7000-8000-0000000000a9' };
    const router = renderCoreAt(coreLinks.people.addRole({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      companyUsersQuery([anna, sara]),
      rolesQuery([shiftLead, companyAdminRole, planner, viewerRole], {}),
      peopleQuery([annaViewer, saraLead]),
      {
        request: {
          query: CoreAssignRole,
          variables: ({ input }: { input: Record<string, string> }) =>
            uuidv7.test(input.id ?? '') &&
            input.userId === anna.id &&
            input.roleId === planner.id &&
            input.scopeId === plantA.id &&
            input.companyId === undefined,
        },
        result: { data: { coreAssignRole: given } },
      } as MockLink.MockedResponse,
      peopleQuery([given, annaViewer, saraLead]),
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add role at Plant A' }),
    ).toBeDefined();
    expect(await screen.findByText('The role applies at Plant A.')).toBeDefined();
    expect(screen.queryByRole('radiogroup', { name: 'Where' })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Person' }));
    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: /^Anna Berg/ }),
    );

    await user.click(screen.getByRole('combobox', { name: 'Role' }));
    const roles = await screen.findByRole('listbox');
    const option = (name: string) =>
      within(roles).getByRole('option', { name: new RegExp(`^${name}`) });
    expect(option('Company admin').getAttribute('aria-disabled')).toBe('true');
    expect(option('Viewer').getAttribute('aria-disabled')).toBe('true');
    expect(
      within(roles).getByText('Planning, default role. Anna Berg already holds it at Plant A.'),
    ).toBeDefined();
    await user.click(option('Planner'));
    await user.click(screen.getByRole('button', { name: 'Add role' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'People' })).toBeDefined();
    expect(router.state.location.pathname).toBe(coreLinks.people({ plant }).href);
    await waitFor(() =>
      expect(spoken()).toBe(
        "Planner at Plant A added for Anna Berg. It applies from Anna Berg's next action.",
      ),
    );
  });

  it('E04-S02 Person searches the users of the company, so a user past the first page is found by name, and each option shows the username, so two people with one name are told apart', async () => {
    const user = userEvent.setup();
    const erik = person('Erik Lind', 'e.lind');
    const annaTwo = { ...person('Anna Berg', 'a.berg2'), blocked: true };
    renderCoreAt(coreLinks.people.addRole({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      companyUsersQuery([anna, annaTwo, sara]),
      rolesQuery([planner], {}),
      peopleQuery([]),
      companyUsersQuery([erik], 'Lind'),
    ]);

    const field = await screen.findByRole('combobox', { name: 'Person' });
    await user.click(field);
    const listbox = await screen.findByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Anna Berga.berg', 'Anna Berga.berg2Blocked', 'Sara Nybergs.nyberg']);

    await user.type(field, 'Lind');
    const found = await within(await screen.findByRole('listbox')).findByRole('option', {
      name: /^Erik Lind/,
    });
    await user.click(found);
    expect((field as HTMLInputElement).value).toBe('Erik Lind');
    const card = await screen.findByRole('region', { name: 'Erik Lind' });
    expect(within(card).getByText('e.lind')).toBeDefined();
  });

  it('E04-S02 Add role without a person lands on Person in the summary and sends nothing', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.people.addRole({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      companyUsersQuery([anna, sara]),
      rolesQuery([planner], {}),
      peopleQuery([]),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Add role' }));

    const summary = await screen.findByRole('group', { name: 'Fix 2 fields to add the role' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).getByRole('link', { name: 'Choose a person.' })).toBeDefined();
  });

  it("E04-S02 a Plant admin opens a person from People and sees the person's roles per place, Remove only at the plant, and what the person can do at the plant", async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(coreLinks.people({ plant }).href, [
      viewerQuery(plantAdmin),
      companiesQuery(),
      peopleQuery([annaViewer, saraLead]),
      {
        request: { query: CoreUser, variables: { id: sara.id } },
        result: {
          data: {
            coreUser: userOf(sara, [
              assignment(viewerRole, acme),
              assignment(shiftLead, plantA, saraLead.id),
            ]),
          },
        },
      },
      rolesQuery([shiftLead, viewerRole], {}),
      {
        request: { query: CoreUserPermissions, variables: { id: sara.id } },
        result: {
          data: {
            coreUser: {
              __typename: 'User',
              id: sara.id,
              effectivePermissions: [
                {
                  __typename: 'EffectivePermission',
                  permission: {
                    __typename: 'Permission',
                    key: 'planning.productionOrder:release',
                    installed: true,
                  },
                  grantedBy: [
                    {
                      __typename: 'RoleAssignment',
                      id: saraLead.id,
                      scope: plantA,
                      role: { __typename: 'Role', id: shiftLead.id, name: 'Shift lead' },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    await user.click(await screen.findByRole('link', { name: 'Sara Nyberg' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sara Nyberg' })).toBeDefined();
    expect(router.state.location.pathname).toBe(
      coreLinks.people.person({ plant, userId: sara.id }).href,
    );
    const roles = await screen.findByRole('table', { name: 'Roles of Sara Nyberg' });
    await waitFor(() =>
      expect(bodyRows(roles)).toEqual([
        ['Shift leadCustom role', 'Plant A', 'Remove'],
        [
          'ViewerPlanning, default role',
          'Acme AB, all plants',
          'A company admin of Acme AB can remove it.',
        ],
      ]),
    );
    expect(screen.getByText("Sara Nyberg's roles that apply at Plant A.")).toBeDefined();
    const can = await screen.findByRole('region', { name: 'What Sara Nyberg can do at Plant A' });
    expect(await within(can).findByText('Release production orders to the floor')).toBeDefined();
    expect(within(can).getByText('Shift lead at Plant A')).toBeDefined();
  });

  it('E04-S02 a reader without core.user:read at the plant gets the page No access to People', async () => {
    renderCoreAt(coreLinks.people({ plant }).href, [
      viewerQuery(['core.article:read']),
      companiesQuery(),
      {
        request: { query: CorePlantRoleAssignments },
        result: { data: null, errors: [forbiddenError(['corePlantRoleAssignments'])] },
      },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to People' }),
    ).toBeDefined();
    expect(
      await screen.findByText(
        'Opening People needs the permission to read users and their roles (core.user:read) at Plant A. Ask a plant admin for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
