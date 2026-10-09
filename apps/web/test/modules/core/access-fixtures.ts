// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { CoreCompanies } from '../../../src/modules/core/companies.graphql.ts';
import { CorePermissionCatalog } from '../../../src/modules/core/components/permission-checklist/permission-catalog.graphql.ts';
import { CoreRole } from '../../../src/modules/core/role.graphql.ts';
import { CoreRoles } from '../../../src/modules/core/roles.graphql.ts';
import { CoreUser } from '../../../src/modules/core/user.graphql.ts';
import { CoreViewer } from '../../../src/modules/core/viewer.graphql.ts';

// Fictional data of the access tests: Acme AB with Plant A, the plant every test opens.

/** An id made from a name, in the shape of a uuidv7: the last group is a hash of the name. */
export function idOf(name: string): string {
  let hash = 0n;
  for (const char of name) hash = (hash * 131n + BigInt(char.charCodeAt(0))) % 2n ** 48n;
  return `019a0000-0000-7000-8000-${hash.toString(16).padStart(12, '0')}`;
}

export const acme = {
  __typename: 'AccessScope',
  id: idOf('acme'),
  kind: 'COMPANY',
  name: 'Acme AB',
} as const;
export const plantA = {
  __typename: 'AccessScope',
  id: idOf('plant-a'),
  kind: 'PLANT',
  name: 'Plant A',
} as const;

/** The signed-in user of every test. */
export const viewerId = idOf('jonas');

/** A forbidden refusal of a read or a field, as the API answers it. */
export function forbiddenError(
  path: readonly (string | number)[],
  message = 'You need a permission',
) {
  return { message, path, extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' } };
}

/** coreViewer with these permissions at the plant and at the company. */
export function viewerQuery(
  plantPermissions: readonly string[],
  companyPermissions: readonly string[] = [],
): MockLink.MockedResponse {
  return {
    request: { query: CoreViewer },
    result: {
      data: {
        coreViewer: {
          __typename: 'Viewer',
          userId: viewerId,
          plantPermissions,
          companyPermissions,
        },
      },
    },
  };
}

/** coreCompanies: Acme AB with Plant A. */
export function companiesQuery(): MockLink.MockedResponse {
  return {
    request: { query: CoreCompanies },
    result: {
      data: {
        coreCompanies: [
          {
            __typename: 'Company',
            id: acme.id,
            name: 'Acme AB',
            plants: [{ __typename: 'Plant', id: plantA.id, slug: 'plant-a', name: 'Plant A' }],
          },
        ],
      },
    },
  };
}

/** The permissions of the catalog, installed, by module and resource. */
export const catalogKeys = {
  core: ['core.role:read', 'core.role:manage', 'core.user:read'],
  planning: [
    'planning.productionOrder:read',
    'planning.productionOrder:release',
    'planning.autoplan:run',
  ],
} as const;

/** corePermissionCatalog with catalogKeys, and a module that is not installed. */
export function catalogQuery(): MockLink.MockedResponse {
  const moduleOf = (moduleId: string, keys: readonly string[], installed = true) => ({
    __typename: 'PermissionModule',
    moduleId,
    resources: [
      {
        __typename: 'PermissionResource',
        resource: `${moduleId}.all`,
        permissions: keys.map((key) => ({ __typename: 'Permission', key, installed })),
      },
    ],
  });
  return {
    request: { query: CorePermissionCatalog },
    result: {
      data: {
        corePermissionCatalog: [
          moduleOf('core', catalogKeys.core),
          moduleOf('planning', catalogKeys.planning),
          moduleOf('kanban', ['kanban.board:read'], false),
        ],
      },
    },
  };
}

/** A person as the API returns a holder's user. */
export function person(name: string, username: string) {
  return { __typename: 'User', id: idOf(username), name, username } as const;
}

export const sara = person('Sara Nyberg', 's.nyberg');
export const anna = person('Anna Berg', 'a.berg');

interface RoleOptions {
  readonly origin?: 'CUSTOM' | 'MODULE';
  readonly moduleId?: string | null;
  readonly version?: number;
  readonly holders?: readonly {
    readonly user: ReturnType<typeof person>;
    readonly scope: typeof acme | typeof plantA;
  }[];
}

/** A role as CoreRole returns it. */
export function role(name: string, permissions: readonly string[], options: RoleOptions = {}) {
  const { origin = 'CUSTOM', moduleId = null, version = 1, holders = [] } = options;
  return {
    __typename: 'Role',
    id: idOf(name),
    name,
    origin,
    moduleId,
    permissions,
    version,
    holders: holders.map(({ user, scope }) => ({
      __typename: 'RoleAssignment',
      id: idOf(`${name}-${user.username}`),
      scope,
      user,
    })),
  };
}

export const shiftLead = role(
  'Shift lead',
  ['planning.productionOrder:read', 'planning.productionOrder:release'],
  {
    holders: [
      { user: sara, scope: plantA },
      { user: anna, scope: plantA },
    ],
  },
);
export const planner = role(
  'Planner',
  ['planning.productionOrder:read', 'planning.productionOrder:release', 'planning.autoplan:run'],
  { origin: 'MODULE', moduleId: 'planning' },
);
export const viewerRole = role('Viewer', ['planning.productionOrder:read'], {
  origin: 'MODULE',
  moduleId: 'planning',
  holders: [{ user: sara, scope: acme }],
});

/** A role as CoreRoles lists it, without the holders' names. */
function listed(each: ReturnType<typeof role>) {
  return {
    ...each,
    holders: each.holders.map(({ id, scope }) => ({
      __typename: 'RoleAssignment',
      id,
      scope: { __typename: 'AccessScope', id: scope.id, kind: scope.kind },
    })),
  };
}

/** coreRoles with these roles. */
export function rolesQuery(roles: readonly ReturnType<typeof role>[]): MockLink.MockedResponse {
  return { request: { query: CoreRoles }, result: { data: { coreRoles: roles.map(listed) } } };
}

/** coreRole for the role. */
export function roleQuery(each: ReturnType<typeof role>): MockLink.MockedResponse {
  return {
    request: { query: CoreRole, variables: { id: each.id } },
    result: { data: { coreRole: each } },
  };
}

/** A user's role at a place, as CoreUser returns it; null role for a reader without core.role:read. */
export function assignment(
  of: ReturnType<typeof role> | null,
  scope: typeof acme | typeof plantA,
  id = idOf(`${of?.name ?? 'hidden'}-${scope.name}`),
) {
  return {
    __typename: 'RoleAssignment',
    id,
    scope,
    role:
      of === null
        ? null
        : { __typename: 'Role', id: of.id, name: of.name, permissions: of.permissions },
  };
}

/** A user as CoreUser returns it. */
export function user(
  who: ReturnType<typeof person>,
  assignments: readonly ReturnType<typeof assignment>[],
  blocked = false,
) {
  return { ...who, blocked, roleAssignments: assignments };
}

/** coreUser for the user, with errors beside the data when given. */
export function userQuery(
  of: ReturnType<typeof user>,
  errors?: readonly ReturnType<typeof forbiddenError>[],
): MockLink.MockedResponse {
  return {
    request: { query: CoreUser, variables: { id: of.id } },
    result: { data: { coreUser: of }, ...(errors !== undefined && { errors }) },
  };
}
