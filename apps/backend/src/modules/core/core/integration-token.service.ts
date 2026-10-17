// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { can } from './access/access.ts';
import { forbidden, readIn, requestScope } from './access/request-scope.ts';
import { type RoleRecord, roleColumns } from './role.service.ts';
import type { AccessScopeRecord } from './role-assignment.service.ts';
import type { UserRecord } from './user.service.ts';

/** The permission that reads and changes a company's integration tokens (ADR 0073). */
const MANAGE = 'core.integration:manage';

/**
 * An integration token of a company as core's service hands it out (ADR 0073): what
 * core.credential records of it, never its secret, which Better Auth holds as a hash only.
 */
export interface IntegrationTokenRecord {
  readonly id: string;
  readonly name: string;
  /** Grows by one with every change to the token; a revoke sends it as expectedVersion. */
  readonly version: number;
  /** The company or the plant where the token holds its roles. */
  readonly scope: AccessScopeRecord;
  /** The roles the token holds there, by name. */
  readonly roles: readonly RoleRecord[];
  /** The user who created the token. */
  readonly createdBy: UserRecord;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  /** When the token was revoked, or null while it is not. */
  readonly revokedAt: Date | null;
  /** When the token was last used, to the minute, or null when it never was. */
  readonly lastUsedAt: Date | null;
  readonly companyId: string;
}

/**
 * The integration tokens of a company that `where` keeps, newest first, read in the transaction
 * with its scopes, so a company outside them has none.
 */
export async function integrationTokens(
  tx: Transaction<CoreDatabase>,
  where: { readonly companyId: string } | { readonly id: string },
): Promise<IntegrationTokenRecord[]> {
  let query = tx
    .selectFrom('core.credential as t')
    .innerJoin('core.scope as s', 's.id', 't.binding_scope_id')
    .leftJoin('core.company as c', 'c.id', 't.binding_scope_id')
    .leftJoin('core.plant as p', 'p.id', 't.binding_scope_id')
    .innerJoin('core.user_directory as u', 'u.id', 't.created_by')
    .select([
      't.id',
      't.name',
      't.version',
      't.scope_id as companyId',
      't.binding_scope_id as scopeId',
      's.kind',
      'c.name as companyName',
      'p.name as plantName',
      't.role_ids as roleIds',
      't.created_at as createdAt',
      't.expires_at as expiresAt',
      't.revoked_at as revokedAt',
      't.last_used_at as lastUsedAt',
      'u.id as userId',
      'u.name as userName',
      'u.username',
      'u.banned',
    ])
    .where('t.kind', '=', 'integration');
  query =
    'id' in where
      ? query.where('t.id', '=', where.id)
      : query.where('t.scope_id', '=', where.companyId);
  const rows = await query.orderBy('t.created_at', 'desc').orderBy('t.id', 'desc').execute();
  const roleIds = [...new Set(rows.flatMap(({ roleIds: ids }) => ids))];
  const roles =
    roleIds.length === 0
      ? []
      : await tx.selectFrom('core.role').select(roleColumns).where('id', 'in', roleIds).execute();
  const roleById = new Map(roles.map((role) => [role.id, role]));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    version: row.version,
    scope: {
      id: row.scopeId,
      kind: row.kind,
      name: row.companyName ?? row.plantName ?? '',
    },
    roles: row.roleIds
      .flatMap((id) => roleById.get(id) ?? [])
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    createdBy: {
      id: row.userId,
      name: row.userName,
      username: row.username,
      blocked: row.banned,
      companyId: row.companyId,
    },
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    companyId: row.companyId,
  }));
}

/**
 * Reads the integration tokens of a company (ADR 0073): the company of the request's plant, or in
 * company settings the company the request names. It needs core.integration:manage at the company
 * itself, where the commands on tokens check it too, so a role with it at a plant does not reach
 * the company's tokens. Only a Company admin holds it by default.
 */
@Injectable()
export class IntegrationTokenService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** Every integration token of the request's company, revoked ones too, newest first. */
  tokens(companyId?: string): Promise<IntegrationTokenRecord[]> {
    const scope = requestScope(MANAGE, companyId);
    if (!can(scope.principal, MANAGE, scope.companyId)) {
      throw forbidden(`You need ${MANAGE} at company ${scope.companyId}`);
    }
    return readIn(scope, () =>
      this.db.transaction((tx) => integrationTokens(tx, { companyId: scope.companyId })),
    );
  }
}
