// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApolloCache, Reference } from '@apollo/client';

// After a write, the company's roles and a role's holders change in the cache in place, so the
// roles list, Start from, Add role and a role's Holders tab show the change without a reload.
// Evicting them instead would make the page still on screen read them again as it moves on.

/** The order of the roles list: custom roles, then default roles, each by name. */
function rank(origin: unknown, name: unknown): string {
  return `${origin === 'CUSTOM' ? 0 : 1}${String(name)}`;
}

/**
 * Lists a created role among the company's roles, in the list's order. Nothing changes when the
 * roles were not read yet.
 */
export function listRole(cache: ApolloCache, roleId: string): void {
  cache.modify<{ coreRoles: readonly Reference[] }>({
    fields: {
      coreRoles: (refs, { readField, toReference }) => {
        const role = toReference({ __typename: 'Role', id: roleId });
        if (role === undefined || refs.some((ref) => readField('id', ref) === roleId)) return refs;
        const key = (ref: Reference) => rank(readField('origin', ref), readField('name', ref));
        const at = refs.findIndex((ref) => key(ref).localeCompare(key(role)) > 0);
        return at === -1 ? [...refs, role] : [...refs.slice(0, at), role, ...refs.slice(at)];
      },
    },
  });
}

/** Adds an assignment the mutation returned to its role's holders, when they were read. */
export function addHolder(cache: ApolloCache, roleId: string, assignmentId: string): void {
  cache.modify<{ holders: readonly Reference[] }>({
    id: cache.identify({ __typename: 'Role', id: roleId }),
    fields: {
      holders: (refs, { readField, toReference }) => {
        const holder = toReference({ __typename: 'RoleAssignment', id: assignmentId });
        if (holder === undefined || refs.some((ref) => readField('id', ref) === assignmentId)) {
          return refs;
        }
        return [...refs, holder];
      },
    },
  });
}

/** Takes a removed assignment out of its role's holders. A role the reader may not read has no id. */
export function removeHolder(
  cache: ApolloCache,
  roleId: string | undefined,
  assignmentId: string,
): void {
  if (roleId === undefined) return;
  cache.modify<{ holders: readonly Reference[] }>({
    id: cache.identify({ __typename: 'Role', id: roleId }),
    fields: {
      holders: (refs, { readField }) => refs.filter((ref) => readField('id', ref) !== assignmentId),
    },
  });
}
