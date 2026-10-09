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
  catalogQuery,
  companiesQuery,
  companyAdminRole,
  companyId,
  groupedRows,
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
import { renderCoreAt, spoken } from './core-app.tsx';

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
  reason?: string,
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreAssignRole,
      variables: ({ input }: { input: Record<string, string> }) =>
        uuidv7.test(input.id ?? '') &&
        input.userId === anna.id &&
        input.roleId === of.id &&
        input.scopeId === scope.id &&
        input.companyId === companyId &&
        input.reason === reason,
    },
    result,
  } as MockLink.MockedResponse;
}

/** Opens the Role combobox and returns its listbox. */
async function openRoles(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('combobox', { name: 'Role' }));
  return screen.findByRole('listbox');
}

/** The names of the options of a group of the listbox, read from the first line of each. */
function optionNames(group: HTMLElement): (string | null | undefined)[] {
  return within(group)
    .getAllByRole('option')
    .map((option) => option.querySelector('[data-role-name]')?.textContent);
}

/** An option of the listbox by the role's name. */
function option(listbox: HTMLElement, name: string): HTMLElement {
  return within(listbox).getByRole('option', { name: new RegExp(`^${name}`) });
}

describe('Add role', () => {
  it('E04-S02 in company settings Where offers each plant and the company, and the roles the assigner cannot give at the chosen place stay in the list, disabled, with what they need; Add role gives Viewer at Plant A, opens the Access tab and announces it', async () => {
    const user = userEvent.setup();
    const router = renderCoreAt(addRoleHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(annaOfPage),
      rolesQuery([operator, shiftLead, planner, viewerRole]),
      catalogQuery(),
      assignOf(
        viewerRole,
        plantA,
        { data: { coreAssignRole: { ...assignment(viewerRole, plantA), user: anna } } },
        'Covers the night shift',
      ),
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
    expect(within(where).getByText('Applies at Plant A.')).toBeDefined();
    expect(
      within(where).getByText('Applies to every plant of Acme AB, also plants created later.'),
    ).toBeDefined();
    await user.click(within(where).getByRole('radio', { name: 'Plant A only' }));
    // The side column: the person and what the person holds already.
    const personCard = screen.getByRole('region', { name: 'Anna Berg' });
    expect(within(personCard).getByText('a.berg')).toBeDefined();
    expect(within(personCard).getByText('Operator at Plant A')).toBeDefined();
    expect(
      screen.getByText(
        'You can assign a role at Plant A when you hold every permission it includes there. A company admin of Acme AB can assign the others.',
      ),
    ).toBeDefined();
    const role = screen.getByRole('combobox', { name: 'Role' });
    expect(role.getAttribute('placeholder')).toBe('Choose a role');
    const roles = await openRoles(user);
    const assignable = within(roles).getByRole('group', {
      name: 'You can assign these at Plant A',
    });
    const locked = within(roles).getByRole('group', {
      name: 'Needs permissions you do not hold at Plant A',
    });
    expect(optionNames(assignable)).toEqual(['Operator', 'Viewer']);
    expect(optionNames(locked)).toEqual(['Shift lead', 'Planner']);
    expect(option(roles, 'Shift lead').getAttribute('aria-disabled')).toBe('true');
    expect(
      within(roles).getByText(
        'Custom role. Needs 1 permission you do not hold at Plant A: Release production orders to the floor (planning.productionOrder:release).',
      ),
    ).toBeDefined();
    expect(
      within(roles).getByText(
        'Planning, default role. Needs 2 permissions you do not hold at Plant A: Release production orders to the floor (planning.productionOrder:release) and Run autoplan (planning.autoplan:run).',
      ),
    ).toBeDefined();
    expect(option(roles, 'Operator').getAttribute('aria-disabled')).toBe('true');
    expect(
      within(roles).getByText('Custom role. Anna Berg already holds it at Plant A.'),
    ).toBeDefined();
    expect(within(roles).getByText('Planning, default role. 1 permission.')).toBeDefined();

    // The keyboard highlight is the active descendant, and the side card follows it.
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(role.getAttribute('aria-activedescendant')).toBeTruthy());
    const highlighted = document.getElementById(role.getAttribute('aria-activedescendant') ?? '');
    const name = highlighted?.querySelector('[data-role-name]')?.textContent ?? '';
    // The listbox hides the page from the accessibility tree while it is open.
    expect(await screen.findByText(`${name} at Plant A`, { selector: 'h2' })).toBeDefined();

    await user.click(option(roles, 'Viewer'));
    const card = await screen.findByRole('region', { name: 'Viewer at Plant A' });
    expect(
      within(card).getByText(
        'The highlighted role. Each permission it includes, and whether you hold it at Plant A.',
      ),
    ).toBeDefined();
    expect(within(card).getByText('You hold it at Plant A')).toBeDefined();
    const reason = screen.getByRole('textbox', { name: 'Reason (optional)' });
    expect(reason.getAttribute('placeholder')).toBe('Why Anna Berg gets this role');
    expect(reason.getAttribute('maxlength')).toBe('500');
    expect(
      screen.getByText(
        "Shown in the user's history. Do not enter personal data. Up to 500 characters.",
      ),
    ).toBeDefined();
    await user.type(reason, 'Covers the night shift');
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
    const table = await screen.findByRole('table', { name: 'Roles' });
    await waitFor(() =>
      expect(groupedRows(table)[1]?.[1].map((row) => row.slice(0, 4))).toEqual([
        ['Planner', 'Planning', '3 of 6', 'None'],
        ['Viewer', 'Planning', '1 of 6', '2 people'],
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
    const roles = await openRoles(user);

    expect(option(roles, 'Plant admin').getAttribute('aria-disabled')).toBeNull();
    expect(option(roles, 'Company admin').getAttribute('aria-disabled')).toBe('true');
    expect(option(roles, 'Planner')).toBeDefined();
    expect(option(roles, 'Viewer')).toBeDefined();
  });

  it('E05-S06 a permission of a module that is not installed locks no role, since the API grants and checks only installed permissions', async () => {
    const user = userEvent.setup();
    const kanbanReader = role('Kanban reader', ['kanban.board:read']);
    renderCoreAt(addRoleHref, [
      settingsViewerQuery([...companyAdminRole.permissions]),
      companiesQuery(),
      userQuery(annaOfPage),
      rolesQuery([kanbanReader, operator, viewerRole]),
      catalogQuery(),
    ]);

    await user.click(await screen.findByRole('radio', { name: 'Plant A only' }));
    expect(
      await screen.findByText(
        'You can assign a role at Plant A when you hold every permission it includes there. A company admin of Acme AB can assign the others.',
      ),
    ).toBeDefined();
    const roles = await openRoles(user);
    await waitFor(() =>
      expect(option(roles, 'Kanban reader').getAttribute('aria-disabled')).toBeNull(),
    );
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
    expect(
      screen.getByText(
        'Checked when you add it: you need every permission of the role at Acme AB.',
      ),
    ).toBeDefined();
    await user.click(option(await openRoles(user), 'Viewer'));
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
    const role = screen.getByRole('combobox', { name: 'Role' }) as HTMLInputElement;
    expect(role.value).toBe('Viewer');
    expect(role.getAttribute('aria-invalid')).toBe('true');

    link.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(role);
  });

  it('E05-S06 a refusal because the assigner may not assign at the company names the assignment permission there and who can act', async () => {
    const user = userEvent.setup();
    // The page read Jonas Holm's assignment permission at Acme AB, which the API no longer finds.
    renderCoreAt(addRoleHref, [
      settingsViewerQuery(assigner),
      companiesQuery(),
      userQuery(annaOfPage),
      rolesQuery([operator, viewerRole]),
      assignOf(viewerRole, acme, {
        data: null,
        errors: [
          {
            message: 'You need core.roleAssignment:manage at scope x',
            path: ['coreAssignRole'],
            extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
          },
        ],
      }),
    ]);

    await user.click(await screen.findByRole('radio', { name: 'Acme AB, all plants' }));
    await user.click(option(await openRoles(user), 'Viewer'));
    await user.click(screen.getByRole('button', { name: 'Add role' }));

    const summary = await screen.findByRole('group', { name: 'Fix 1 field to add the role' });
    expect(within(summary).getByRole('link').textContent).toBe(
      'You cannot assign Viewer at Acme AB. Assigning at Acme AB needs Assign and remove roles (core.roleAssignment:manage) there. Ask a company admin of Acme AB to assign it.',
    );
  });
});
