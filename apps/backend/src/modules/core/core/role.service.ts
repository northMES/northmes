// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { sql } from 'kysely';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { readIn, requestScope } from './access/request-scope.ts';

/** A role of a company as core's service hands it out (ADR 0010). */
export interface RoleRecord {
  readonly id: string;
  /** Unique within the company: `<module>-<role>` for a default role. */
  readonly key: string;
  readonly name: string;
  /** module for a module's default role, custom for a role the company made. */
  readonly origin: 'module' | 'custom';
  /** The module of a default role, or null for a custom role. */
  readonly moduleId: string | null;
  /** The permission keys the role holds, sorted. */
  readonly permissions: readonly string[];
  /** Grows by one with every change to the role; a change sends it as expectedVersion. */
  readonly version: number;
  /** The company the role belongs to, where the fields of Role read its holders. */
  readonly companyId: string;
}

/** A permission of the catalog (ADR 0010). */
export interface PermissionRecord {
  /** `<module>.<entity>:<action>`. */
  readonly key: string;
  readonly moduleId: string;
  /** `<module>.<entity>`, the key before the colon. */
  readonly resource: string;
  /** The key after the colon. */
  readonly action: string;
  /** False for a permission no installed module declares any more; it grants nothing. */
  readonly installed: boolean;
}

/** The permissions of one resource. */
export interface PermissionResourceRecord {
  readonly resource: string;
  readonly permissions: readonly PermissionRecord[];
}

/** The permissions of one module, by resource. */
export interface PermissionModuleRecord {
  readonly moduleId: string;
  readonly resources: readonly PermissionResourceRecord[];
}

/** The columns of core.role that make a RoleRecord. */
export const roleColumns = [
  'id',
  'key',
  'name',
  'origin',
  'module_id as moduleId',
  'permissions',
  'version',
  'company_id as companyId',
] as const;

/** A permission record of a catalog row. */
export function permissionOf(row: {
  key: string;
  module_id: string;
  installed: boolean;
}): PermissionRecord {
  const [resource = '', action = ''] = row.key.split(':');
  return { key: row.key, moduleId: row.module_id, resource, action, installed: row.installed };
}

/** The rows sorted by key, by character code, so the order is the same whatever the collation. */
export function sortedByKey<Row extends { readonly key: string }>(rows: readonly Row[]): Row[] {
  return [...rows].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Groups permissions by module, core first and the others by id, and then by resource. */
function byModuleAndResource(permissions: readonly PermissionRecord[]): PermissionModuleRecord[] {
  const modules = new Map<string, Map<string, PermissionRecord[]>>();
  for (const permission of permissions) {
    const resources = modules.get(permission.moduleId) ?? new Map<string, PermissionRecord[]>();
    modules.set(permission.moduleId, resources);
    resources.set(permission.resource, [...(resources.get(permission.resource) ?? []), permission]);
  }
  const rank = (id: string) => (id === 'core' ? 0 : 1);
  return [...modules.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([moduleId, resources]) => ({
      moduleId,
      resources: [...resources.entries()].map(([resource, list]) => ({
        resource,
        permissions: list,
      })),
    }));
}

/**
 * Reads the roles of a company and the permission catalog (ADR 0010): the company of the request's
 * plant, or in company settings the company the request names (ADR 0066). Each read needs
 * core.role:read there.
 */
@Injectable()
export class RoleService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** The roles of the request's company: custom roles first, then default roles, each by name. */
  roles(companyId?: string): Promise<RoleRecord[]> {
    const scope = requestScope('core.role:read', companyId);
    return readIn(scope, () =>
      this.db.transaction((tx) =>
        tx
          .selectFrom('core.role')
          .select(roleColumns)
          .where('company_id', '=', scope.companyId)
          .orderBy(sql`origin = 'custom'`, 'desc')
          .orderBy(sql`lower(name)`)
          .orderBy('id')
          .execute(),
      ),
    );
  }

  /**
   * The roles with these ids, one entry per id: the role, or null when the request's company has
   * none with that id.
   */
  async byIds(ids: readonly string[], companyId?: string): Promise<(RoleRecord | null)[]> {
    const scope = requestScope('core.role:read', companyId);
    if (ids.length === 0) return [];
    const roles = await readIn(scope, () =>
      this.db.transaction((tx) =>
        tx
          .selectFrom('core.role')
          .select(roleColumns)
          .where('company_id', '=', scope.companyId)
          .where('id', 'in', ids)
          .execute(),
      ),
    );
    const byId = new Map(roles.map((role) => [role.id, role]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  /** The role with this id of the request's company, or null. */
  async byId(id: string, companyId?: string): Promise<RoleRecord | null> {
    const [role] = await this.byIds([id], companyId);
    return role ?? null;
  }

  /**
   * Every permission of the catalog, installed or not, grouped by module (core first, then by id)
   * and by resource, each sorted by key.
   */
  async catalog(companyId?: string): Promise<PermissionModuleRecord[]> {
    const scope = requestScope('core.role:read', companyId);
    const rows = await readIn(scope, () =>
      this.db.transaction((tx) =>
        tx.selectFrom('core.permission').select(['key', 'module_id', 'installed']).execute(),
      ),
    );
    return byModuleAndResource(sortedByKey(rows).map(permissionOf));
  }
}
