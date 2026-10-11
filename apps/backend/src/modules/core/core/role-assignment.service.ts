// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { type RequestScope, readIn, requestScope } from './access/request-scope.ts';
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
  /** The company of the assignment and its role, where the field role reads the role. */
  readonly companyId: string;
}

/**
 * What a user may do where the request runs, at its plant or in company settings at its company:
 * one permission, and the assignments that grant it.
 */
export interface EffectivePermissionRecord {
  readonly permission: PermissionRecord;
  /** Empty when no role of the user there or above holds the permission. */
  readonly grantedBy: readonly RoleAssignmentRecord[];
}

/**
 * The filter of an assignment read: the roles or the users whose assignments it reads, or every
 * assignment at the request's plant.
 */
type AssignmentFilter =
  | { readonly roleIds: readonly string[] }
  | { readonly userIds: readonly string[] }
  | { readonly atPlant: true };

/**
 * Reads role assignments where the request runs (ADR 0010): at a plant, at its company and the
 * plant, never at another plant; in company settings, at the company the request names and every
 * plant of it (ADR 0066). It reads the holders of roles, the roles of users, the people at the
 * request's plant, and what a user may do there.
 */
@Injectable()
export class RoleAssignmentService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /**
   * The places of the request with their names, the company first: at a plant, its company and the
   * plant; in company settings, the company and its plants by name.
   */
  async #scopes(
    tx: Transaction<CoreDatabase>,
    { companyId, plantId }: RequestScope,
  ): Promise<AccessScopeRecord[]> {
    const company = await tx
      .selectFrom('core.company')
      .select(['id', 'name'])
      .where('id', '=', companyId)
      .executeTakeFirst();
    const plants = await tx
      .selectFrom('core.plant')
      .select(['id', 'name'])
      .$if(plantId !== undefined, (query) => query.where('id', '=', plantId ?? ''))
      .$if(plantId === undefined, (query) => query.where('company_id', '=', companyId))
      .orderBy('name')
      .orderBy('id')
      .execute();
    return [
      ...(company ? [{ ...company, kind: 'company' as const }] : []),
      ...plants.map((plant) => ({ ...plant, kind: 'plant' as const })),
    ];
  }

  /**
   * The assignments that the filter names where the request runs, with the scope sets of the
   * request's scope: those at the company first, then each plant in its order, then each by the
   * holder's name.
   */
  #assignments(scope: RequestScope, filter: AssignmentFilter): Promise<RoleAssignmentRecord[]> {
    return readIn(scope, () => this.#read(scope, filter));
  }

  /** The read of #assignments, in one transaction. */
  #read(scope: RequestScope, filter: AssignmentFilter): Promise<RoleAssignmentRecord[]> {
    return this.db.transaction(async (tx) => {
      const all = await this.#scopes(tx, scope);
      const scopes = 'atPlant' in filter ? all.filter(({ id }) => id === scope.plantId) : all;
      const ids = 'roleIds' in filter ? filter.roleIds : 'userIds' in filter ? filter.userIds : [];
      const everyone = 'atPlant' in filter;
      if ((!everyone && ids.length === 0) || scopes.length === 0) return [];
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
        .$if('roleIds' in filter, (query) => query.where('a.role_id', 'in', ids))
        .$if('userIds' in filter, (query) => query.where('a.user_id', 'in', ids))
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
          const { companyId } = scope;
          const user = { id: userId, name, username, blocked: banned, companyId };
          return [{ id, roleId, scope: at, user, companyId }];
        });
    });
  }

  /**
   * The holders of each role of the company where the request runs, one list per role id. It needs
   * core.role:read there.
   */
  async holdersOf(
    roleIds: readonly string[],
    companyId?: string,
  ): Promise<RoleAssignmentRecord[][]> {
    const scope = requestScope('core.role:read', companyId);
    const assignments = await this.#assignments(scope, { roleIds });
    return roleIds.map((roleId) =>
      assignments.filter((assignment) => assignment.roleId === roleId),
    );
  }

  /**
   * The role assignments of each user where the request runs, one list per user id. It needs
   * core.user:read there.
   */
  async ofUsers(userIds: readonly string[], companyId?: string): Promise<RoleAssignmentRecord[][]> {
    const scope = requestScope('core.user:read', companyId);
    const assignments = await this.#assignments(scope, { userIds });
    return userIds.map((userId) => assignments.filter(({ user }) => user.id === userId));
  }

  /**
   * Every role assignment at the request's plant, by the holder's name: the people a plant admin
   * manages in plant settings. It needs core.user:read at the plant, and a request without a plant
   * gets core.forbidden.
   */
  async atPlant(): Promise<RoleAssignmentRecord[]> {
    const scope = requestScope('core.user:read');
    return this.#assignments(scope, { atPlant: true });
  }

  /**
   * What the user may do where the request runs: every installed permission, by key, with the
   * assignments whose roles hold it, at the plant or at its company, or in company settings at the
   * company alone. It names roles, so it needs core.role:read there.
   */
  async effectivePermissions(
    userId: string,
    companyId?: string,
  ): Promise<EffectivePermissionRecord[]> {
    const scope = requestScope('core.role:read', companyId);
    const read = await this.#assignments(scope, { userIds: [userId] });
    // In company settings only the roles at the company hold there; a plant's roles do not.
    const assignments =
      scope.plantId === undefined ? read.filter((each) => each.scope.kind === 'company') : read;
    const roleIds = [...new Set(assignments.map(({ roleId }) => roleId))];
    const { permissions, roles } = await readIn(scope, () =>
      this.#permissionsAndRoles(scope, roleIds),
    );
    const held = new Map(roles.map(({ id, permissions: keys }) => [id, new Set(keys)]));
    return sortedByKey(permissions).map((row) => ({
      permission: permissionOf(row),
      grantedBy: assignments.filter(({ roleId }) => held.get(roleId)?.has(row.key)),
    }));
  }

  /** The installed permissions, and the permissions of these roles of the request's company. */
  #permissionsAndRoles(scope: RequestScope, roleIds: readonly string[]) {
    return this.db.transaction(async (tx) => ({
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
  }
}
