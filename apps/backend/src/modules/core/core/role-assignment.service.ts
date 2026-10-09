// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { type RequestScope, requestScope } from './access/request-scope.ts';
import { type PermissionRecord, permissionOf, sortedByKey } from './role.service.ts';
import type { UserRecord } from './user.service.ts';

/** A company or a plant, where a role is held. */
export interface AccessScopeRecord {
  /** The scope id. */
  readonly id: string;
  readonly kind: 'company' | 'plant';
  readonly name: string;
}

/** A user's role at a scope (ADR 0010). */
export interface RoleAssignmentRecord {
  readonly id: string;
  readonly roleId: string;
  readonly scope: AccessScopeRecord;
  readonly user: UserRecord;
}

/** What a user may do at the request's plant: one permission, and the assignments that grant it. */
export interface EffectivePermissionRecord {
  readonly permission: PermissionRecord;
  /** Empty when no role of the user at the plant or at its company holds the permission. */
  readonly grantedBy: readonly RoleAssignmentRecord[];
}

/** The filter of an assignment read: the roles or the users whose assignments it reads. */
type AssignmentFilter =
  | { readonly roleIds: readonly string[] }
  | { readonly userIds: readonly string[] };

/**
 * Reads role assignments at the request's company and plant, never at another plant (ADR 0010):
 * the holders of roles, the roles of users, and what a user may do at the plant.
 */
@Injectable()
export class RoleAssignmentService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** The company and the plant of the request with their names, the company first. */
  async #scopes(
    tx: Transaction<CoreDatabase>,
    { companyId, plantId }: RequestScope,
  ): Promise<AccessScopeRecord[]> {
    const company = await tx
      .selectFrom('core.company')
      .select(['id', 'name'])
      .where('id', '=', companyId)
      .executeTakeFirst();
    const plant = await tx
      .selectFrom('core.plant')
      .select(['id', 'name'])
      .where('id', '=', plantId)
      .executeTakeFirst();
    return [
      ...(company ? [{ ...company, kind: 'company' as const }] : []),
      ...(plant ? [{ ...plant, kind: 'plant' as const }] : []),
    ];
  }

  /**
   * The assignments that the filter names at the request's company and plant: those at the company
   * first, then each by the holder's name.
   */
  #assignments(scope: RequestScope, filter: AssignmentFilter): Promise<RoleAssignmentRecord[]> {
    return this.db.transaction(async (tx) => {
      const scopes = await this.#scopes(tx, scope);
      const ids = 'roleIds' in filter ? filter.roleIds : filter.userIds;
      if (ids.length === 0 || scopes.length === 0) return [];
      const rows = await tx
        .selectFrom('core.role_assignment as a')
        .innerJoin('core.user_directory as u', 'u.id', 'a.user_id')
        .select([
          'a.id',
          'a.role_id as roleId',
          'a.scope_id as scopeId',
          'u.id as userId',
          'u.name',
          'u.username',
          'u.banned',
        ])
        .where('roleIds' in filter ? 'a.role_id' : 'a.user_id', 'in', ids)
        .where(
          'a.scope_id',
          'in',
          scopes.map(({ id }) => id),
        )
        .orderBy('u.name')
        .orderBy('a.id')
        .execute();
      const byScope = new Map(scopes.map((record) => [record.id, record]));
      const position = (id: string) => scopes.findIndex((record) => record.id === id);
      return rows
        .sort((a, b) => position(a.scopeId) - position(b.scopeId))
        .flatMap(({ id, roleId, scopeId, userId, name, username, banned }) => {
          const at = byScope.get(scopeId);
          if (!at) return [];
          return [{ id, roleId, scope: at, user: { id: userId, name, username, blocked: banned } }];
        });
    });
  }

  /**
   * The holders of each role at the request's company and plant, one list per role id. It needs
   * core.role:read at the request's plant.
   */
  async holdersOf(roleIds: readonly string[]): Promise<RoleAssignmentRecord[][]> {
    const assignments = await this.#assignments(requestScope('core.role:read'), { roleIds });
    return roleIds.map((roleId) =>
      assignments.filter((assignment) => assignment.roleId === roleId),
    );
  }

  /**
   * The role assignments of each user at the request's company and plant, one list per user id.
   * It needs core.user:read at the request's plant.
   */
  async ofUsers(userIds: readonly string[]): Promise<RoleAssignmentRecord[][]> {
    const assignments = await this.#assignments(requestScope('core.user:read'), { userIds });
    return userIds.map((userId) => assignments.filter(({ user }) => user.id === userId));
  }

  /**
   * What the user may do at the request's plant: every installed permission, by key, with the
   * assignments at the plant or at its company whose roles hold it. It names roles, so it needs
   * core.role:read at the request's plant.
   */
  async effectivePermissions(userId: string): Promise<EffectivePermissionRecord[]> {
    const scope = requestScope('core.role:read');
    const assignments = await this.#assignments(scope, { userIds: [userId] });
    const roleIds = [...new Set(assignments.map(({ roleId }) => roleId))];
    const { permissions, roles } = await this.db.transaction(async (tx) => ({
      permissions: await tx
        .selectFrom('core.permission')
        .select(['key', 'module_id', 'installed'])
        .where('installed', '=', true)
        .execute(),
      roles:
        roleIds.length === 0
          ? []
          : await tx
              .selectFrom('core.role')
              .select(['id', 'permissions'])
              .where('company_id', '=', scope.companyId)
              .where('id', 'in', roleIds)
              .execute(),
    }));
    const held = new Map(roles.map(({ id, permissions: keys }) => [id, new Set(keys)]));
    return sortedByKey(permissions).map((row) => ({
      permission: permissionOf(row),
      grantedBy: assignments.filter(({ roleId }) => held.get(roleId)?.has(row.key)),
    }));
  }
}
