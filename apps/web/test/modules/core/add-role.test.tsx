// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreAssignRole } from '../../../src/modules/core/components/assign-role-form/assign-role.graphql.ts';
import { CoreUserPermissions } from '../../../src/modules/core/screens/user/user-permissions.graphql.ts';
import {
  acme,
  anna,
  assignment,
  companiesQuery,
  companyAdminRole,
  companyId,
  planner,
  plantA,
  plantAdminRole,
  role,
  rolesQuery,
  settingsViewerQuery,
  shiftLead,
  user,
  userQuery,
  viewerRole,
} from './access-fixtures.ts';
import { bodyRows, renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/** Jonas Holm holds read and the assignment permission at Acme AB, not release. */
const assigner = [
  'core.user:read',
  'core.role:read',
  'core.roleAssignment:manage',
  'planning.productionOrder:read',
];

/** A custom role Anna Berg holds at Plant A already. */
const operator = role('Operator', ['planning.productionOrder:read']);

const annaOfPage = user(anna, [assignment(operator, plantA)]);

const addRoleHref = coreLinks.settings.users.user.addRole({ companyId, userId: anna.id }).href;

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** coreAssignRole of the role at the scope for Anna Berg, answered by result. */
function assignOf(
  of: ReturnType<typeof role>,
  scope: typeof acme | typeof plantA,
  result: MockLink.MockedResponse['result'],
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreAssignRole,
      variables: ({ input }: { input: Record<string, string> }) =>
        uuidv7.test(input.id ?? '') &&
        input.userId === anna.id &&
        input.roleId === of.id &&
        input.scopeId === scope.id &&
        input.companyId === companyId,
    },
    result,
  } as MockLink.MockedResponse;
}

describe('Add role', () => {
  it('E04-S02 in company settings Where offers each plant and the company, and the roles the assigner cannot give at the chosen place stay in the list, disabled, with what they need; Add role gives Viewer at Plant A, opens the Access tab and announces it', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(addRoleHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(annaOfPage),
      rolesQuery([operator, shiftLead, planner, viewerRole]),
      assignOf(viewerRole, plantA, {
        data: { coreAssignRole: { ...assignment(viewerRole, plantA), user: anna } },
      }),
      {
        request: { query: CoreUserPermissions, variables: { id: anna.id, companyId } },
        result: {
          data: { coreUser: { __typename: 'User', id: anna.id, effectivePermissions: [] } },
        },
      },
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add role for Anna Berg' }),
    ).toBeDefined();
    const where = await screen.findByRole('radiogroup', { name: 'Where' });
    expect(
      within(where)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-checked')),
    ).toEqual(['false', 'false']);
    await user.click(within(where).getByRole('radio', { name: 'Plant A only' }));
    const roles = screen.getByRole('radiogroup', { name: 'Role' });
    const shift = within(roles).getByRole('radio', { name: 'Shift lead' });
    expect(shift.hasAttribute('data-disabled')).toBe(true);
    expect(
      screen.getByText(
        'You do not hold 1 permission of it at Plant A: Release production orders to the floor (planning.productionOrder:release).',
      ),
    ).toBeDefined();
    expect(
      within(roles).getByRole('radio', { name: 'Operator' }).hasAttribute('data-disabled'),
    ).toBe(true);
    expect(screen.getByText('Anna Berg holds it at Plant A already.')).toBeDefined();

    await user.click(within(roles).getByRole('radio', { name: 'Viewer' }));
    expect(screen.getByRole('region', { name: 'Permissions of Viewer' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Add role' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Anna Berg' })).toBeDefined();
    expect(router.state.location.search).toEqual({ tab: 'access' });
    await waitFor(() =>
      expect(spoken()).toBe(
        "Viewer at Plant A added for Anna Berg. It applies from Anna Berg's next action.",
      ),
    );
    expect(await screen.findByRole('link', { name: 'Viewer' })).toBeDefined();

    // The roles list read before the assignment counts the new holder.
    await router.navigate({ to: coreLinks.settings.roles({ companyId }).href });
    const defaults = await screen.findByRole('table', { name: 'Default roles from modules' });
    await waitFor(() =>
      expect(bodyRows(defaults)).toEqual([
        ['Planner', 'Planning', '3', '0'],
        ['Viewer', 'Planning', '1', '2'],
      ]),
    );
  });

  it("E05-S06 the role picker lists core's Plant admin like the other default roles, and an assigner without the company-level permissions cannot give Company admin", async () => {
    const user = userEvent.setup();
    renderCoreAt(addRoleHref, [
      settingsViewerQuery([...plantAdminRole.permissions]),
      companiesQuery(),
      userQuery(annaOfPage),
      rolesQuery([operator, companyAdminRole, plantAdminRole, planner, viewerRole]),
    ]);

    await user.click(await screen.findByRole('radio', { name: 'Plant A only' }));
    const roles = await screen.findByRole('radiogroup', { name: 'Role' });
    const plantAdmin = within(roles).getByRole('radio', { name: 'Plant admin' });
    const companyAdmin = within(roles).getByRole('radio', { name: 'Company admin' });

    expect(plantAdmin.hasAttribute('data-disabled')).toBe(false);
    expect(companyAdmin.hasAttribute('data-disabled')).toBe(true);
    expect(within(roles).getByRole('radio', { name: 'Planner' })).toBeDefined();
    expect(within(roles).getByRole('radio', { name: 'Viewer' })).toBeDefined();
  });

  it('E05-S06 a refusal of the API at the company lands on Role: the summary takes focus with the message, the choices stay, and its link leads to Role', async () => {
    const user = userEvent.setup();
    renderCoreAt(addRoleHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(annaOfPage),
      rolesQuery([operator, viewerRole]),
      assignOf(viewerRole, acme, {
        data: null,
        errors: [
          {
            message: 'You do not hold core.article:read at scope x',
            path: ['coreAssignRole'],
            extensions: {
              code: 'FORBIDDEN',
              errorCode: 'core.role_not_held',
              details: {
                scopeId: acme.id,
                missingPermissions: ['core.article:read', 'planning.productionOrder:read'],
              },
            },
          },
        ],
      }),
    ]);

    await user.click(await screen.findByRole('radio', { name: 'Acme AB, all plants' }));
    await user.click(screen.getByRole('radio', { name: 'Viewer' }));
    await user.click(screen.getByRole('button', { name: 'Add role' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to add the role' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    const message =
      'You cannot assign Viewer at Acme AB. It includes 2 permissions you do not hold at Acme AB: Read articles (core.article:read) and Read production orders and the planning board (planning.productionOrder:read). Ask a company admin of Acme AB to assign it.';
    const link = within(summary).getByRole('link');
    expect(link.textContent).toBe(message);
    expect(
      screen.getByRole('radio', { name: 'Acme AB, all plants' }).getAttribute('aria-checked'),
    ).toBe('true');
    const viewer = screen.getByRole('radio', { name: 'Viewer' });
    expect(viewer.getAttribute('aria-checked')).toBe('true');

    link.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(viewer);
  });
});
