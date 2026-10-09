// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { coreLinks } from '@northmes/core-contracts';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoreRole } from '../../../src/modules/core/role.graphql.ts';
import { CoreUpdateRole } from '../../../src/modules/core/screens/edit-role/update-role.graphql.ts';
import { CoreCreateRole } from '../../../src/modules/core/screens/new-role/create-role.graphql.ts';
import {
  catalogQuery,
  companiesQuery,
  planner,
  role,
  roleQuery,
  rolesQuery,
  shiftLead,
  viewerQuery,
  viewerRole,
} from './access-fixtures.ts';
import { plant, renderCoreAt, spoken } from './core-app.tsx';

afterEach(cleanup);

/** A uuidv7: version 7 in the third group, variant 10 in the fourth. */
const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Jonas Holm manages roles and holds the planning permissions but Run autoplan at Plant A. */
const jonas = [
  'core.role:read',
  'core.role:manage',
  'planning.productionOrder:read',
  'planning.productionOrder:release',
];

/** Karin Dahl manages roles and holds every permission of the catalog. */
const karin = [...jonas, 'core.user:read', 'planning.autoplan:run'];

function checkbox(name: string): HTMLElement {
  return screen.getByRole('checkbox', { name });
}

describe('the role editor', () => {
  it('E05-S06 New role from Planner copies its permissions once and shows the difference; a permission the editor does not hold is locked; Create role opens the new role and announces it', async () => {
    const user = userEvent.setup();
    const created = role('Night planner', [
      'planning.productionOrder:read',
      'planning.autoplan:run',
    ]);
    const router = renderCoreAt(coreLinks.roles.new({ plant }, { from: planner.id }).href, [
      viewerQuery(jonas, ['core.role:manage']),
      companiesQuery(),
      rolesQuery([shiftLead, planner, viewerRole]),
      catalogQuery(),
      {
        request: {
          query: CoreCreateRole,
          variables: ({ input }: { input: { id: string; name: string; permissions: string[] } }) =>
            uuidv7.test(input.id) &&
            input.name === 'Night planner' &&
            input.permissions.join() === 'planning.productionOrder:read,planning.autoplan:run',
        },
        result: { data: { coreCreateRole: created } },
      } as MockLink.MockedResponse,
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'New role' })).toBeDefined();
    const startFrom = (await screen.findByRole('combobox', {
      name: 'Start from',
    })) as HTMLSelectElement;
    expect(startFrom.value).toBe(planner.id);
    expect(
      screen.getByText(
        'The new role copies its permissions once. It does not follow later changes to Planner.',
      ),
    ).toBeDefined();
    expect((await screen.findByRole('status')).textContent).toBe('3 of 6 selected.');

    // Run autoplan is locked: a disabled checkbox without a Tab stop, described by why.
    const autoplan = checkbox('Run autoplan');
    expect(autoplan.hasAttribute('disabled')).toBe(true);
    expect(autoplan.getAttribute('aria-describedby')).toBeTruthy();
    expect((await screen.findAllByText('You do not hold it at Plant A.')).length).toBeGreaterThan(0);
    // The module that is not installed never shows.
    expect(screen.queryByText('kanban.board:read')).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Role name' }), 'Night planner');
    const release = checkbox('Release production orders to the floor');
    release.focus();
    await user.keyboard(' ');

    expect(document.activeElement).toBe(release);
    expect(release.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('2 of 6 selected.');
    const difference = screen.getByRole('region', { name: 'Difference from Planner' });
    expect(within(difference).getByText('Removed')).toBeDefined();
    expect(within(difference).getByText('Release production orders to the floor')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Night planner' })).toBeDefined();
    expect(router.state.location.pathname).toBe(
      coreLinks.roles.role({ plant, roleId: created.id }).href,
    );
    await waitFor(() => expect(spoken()).toBe('Night planner created.'));
  });

  it('E05-S06 Enter on a module button closes and opens the module, and focus stays on it', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.roles.new({ plant }).href, [
      viewerQuery(karin, ['core.role:manage']),
      companiesQuery(),
      rolesQuery([shiftLead]),
      catalogQuery(),
    ]);

    const planning = await screen.findByRole('button', { name: /^Planning/ });
    expect(planning.getAttribute('aria-expanded')).toBe('true');
    expect(planning.closest('h3')).not.toBeNull();
    planning.focus();
    await user.keyboard('{Enter}');

    expect(planning.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(planning);
    expect(screen.queryByRole('checkbox', { name: 'Run autoplan' })).toBeNull();
  });

  it('E05-S06 Edit role saves the ticks and the reason with the version it started from, opens the role and says whom it applies to', async () => {
    const user = userEvent.setup();
    const saved = {
      ...shiftLead,
      version: 2,
      permissions: [...shiftLead.permissions, 'planning.autoplan:run'],
    };
    renderCoreAt(coreLinks.roles.role.edit({ plant, roleId: shiftLead.id }).href, [
      viewerQuery(karin, ['core.role:manage']),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: {
            input: {
              id: shiftLead.id,
              expectedVersion: 1,
              name: 'Shift lead',
              permissions: [...shiftLead.permissions, 'planning.autoplan:run'],
              reason: 'Night shift plans too',
            },
          },
        },
        result: { data: { coreUpdateRole: saved } },
      },
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit Shift lead' })).toBeDefined();
    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    expect(screen.getByText('Changes not saved')).toBeDefined();
    await user.type(
      screen.getByRole('textbox', { name: 'Reason (optional)' }),
      'Night shift plans too',
    );
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Shift lead' })).toBeDefined();
    await waitFor(() =>
      expect(spoken()).toBe('Shift lead saved. It applies to 2 people from their next action.'),
    );
  });

  it('E05-S06 a Save the API refuses by the grant rule keeps every tick and the reason, and the summary takes focus and names the permission and who can act', async () => {
    const user = userEvent.setup();
    renderCoreAt(coreLinks.roles.role.edit({ plant, roleId: shiftLead.id }).href, [
      viewerQuery(karin, ['core.role:manage']),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: {
            input: {
              id: shiftLead.id,
              expectedVersion: 1,
              name: 'Shift lead',
              permissions: [...shiftLead.permissions, 'planning.autoplan:run'],
              reason: 'Night shift',
            },
          },
        },
        result: {
          data: null,
          errors: [
            {
              message: 'You do not hold planning.autoplan:run at scope x',
              path: ['coreUpdateRole'],
              extensions: {
                code: 'FORBIDDEN',
                errorCode: 'core.role_not_held',
                details: { scopeId: 'x', missingPermissions: ['planning.autoplan:run'] },
              },
            },
          ],
        },
      },
    ]);

    // The refusal names the company, so the places load first.
    expect(await screen.findByText('Unique within Acme AB.')).toBeDefined();
    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.type(screen.getByRole('textbox', { name: 'Reason (optional)' }), 'Night shift');
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    const summary = await screen.findByRole('group', { name: 'Shift lead was not saved' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(within(summary).queryByRole('link')).toBeNull();
    expect(within(summary).getByRole('listitem').textContent).toBe(
      'You do not hold 1 permission of Shift lead where it applies: Run autoplan (planning.autoplan:run). A role can only get permissions you hold. Ask a company admin of Acme AB to change it.',
    );
    const autoplan = checkbox('Run autoplan');
    expect(autoplan.getAttribute('aria-checked')).toBe('true');
    expect(autoplan.getAttribute('aria-invalid')).toBe('true');
    expect(
      (screen.getByRole('textbox', { name: 'Reason (optional)' }) as HTMLTextAreaElement).value,
    ).toBe('Night shift');
  });

  it('E05-S06 a Save refused because the role changed offers Reload role, which fills the saved role and moves focus to Role name', async () => {
    const user = userEvent.setup();
    const renamed = { ...shiftLead, name: 'Shift leader', version: 2 };
    renderCoreAt(coreLinks.roles.role.edit({ plant, roleId: shiftLead.id }).href, [
      viewerQuery(karin, ['core.role:manage']),
      companiesQuery(),
      roleQuery(shiftLead),
      catalogQuery(),
      {
        request: {
          query: CoreUpdateRole,
          variables: (variables: Record<string, unknown>) => variables.input !== undefined,
        },
        result: {
          data: null,
          errors: [
            {
              message: 'The role changed',
              path: ['coreUpdateRole'],
              extensions: { code: 'CONFLICT', errorCode: 'core.version_conflict' },
            },
          ],
        },
      } as MockLink.MockedResponse,
      {
        request: { query: CoreRole, variables: { id: shiftLead.id } },
        result: { data: { coreRole: renamed } },
      },
    ]);

    await user.click(await screen.findByRole('checkbox', { name: 'Run autoplan' }));
    await user.click(screen.getByRole('button', { name: 'Save role' }));

    const summary = await screen.findByRole('group', {
      name: 'This role changed while you edited it',
    });
    await user.click(within(summary).getByRole('button', { name: 'Reload role' }));

    const name = screen.getByRole('textbox', { name: 'Role name' }) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Shift leader'));
    expect(document.activeElement).toBe(name);
    expect(checkbox('Run autoplan').getAttribute('aria-checked')).toBe('false');
  });

  it('E05-S06 the edit route without core.role:manage at Acme AB, even with it at Plant A, is the page No access to Edit role', async () => {
    renderCoreAt(coreLinks.roles.role.edit({ plant, roleId: shiftLead.id }).href, [
      viewerQuery(['core.role:read', 'core.role:manage']),
      companiesQuery(),
      roleQuery(shiftLead),
    ]);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No access to Edit role' }),
    ).toBeDefined();
    expect(
      await screen.findByText(
        'Opening Edit role needs the permission to create and edit roles (core.role:manage) at Acme AB. Ask a company admin of Acme AB for a role that includes it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Role name' })).toBeNull();
  });
});
