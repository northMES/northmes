// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { sql } from 'kysely';
import {
  PLANT_HEADER,
  type Principal,
  PrincipalResolver,
  runAs,
  type ScopeGrant,
} from '../../../../principal.ts';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { accessOf } from './access.ts';
import { AuthService } from './auth.service.ts';

/** The bearer token of an Authorization header. */
const bearer = /^Bearer\s+(\S+)$/i;

/** A row of the principal's query: one scope node and what is granted directly at it. */
interface GrantRow {
  readonly id: string;
  readonly parent_id: string | null;
  readonly permissions: string[];
}

/**
 * Resolves the principal of a request (ADR 0010, ADR 0011): from the JWT in its Authorization
 * header to the user, and from the user's role assignments to its scope tree, permissions and
 * scope sets, in one query per request.
 */
@Injectable()
export class PrincipalService extends PrincipalResolver {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {
    super();
  }

  /**
   * The principal of a request with these headers, or null when it carries no bearer token, or one
   * that is not a valid JWT of this API.
   */
  async resolve(headers: Headers): Promise<Principal | null> {
    const token = bearer.exec(headers.get('authorization') ?? '')?.[1];
    if (!token) return null;
    const userId = await this.auth.userOfToken(token);
    if (!userId) return null;
    return this.forUser(userId, headers.get(PLANT_HEADER) ?? undefined);
  }

  /**
   * The principal of a user at the plant that plantId names. Its scope tree holds every node of
   * the companies where the user holds a role, each with the installed permissions of the roles
   * assigned at it. The tables carry no policies, so the query runs without scopes.
   */
  async forUser(userId: string, plantId?: string): Promise<Principal> {
    const rows = await runAs(null, () =>
      this.db.transaction(async (tx) => {
        const { rows } = await sql<GrantRow>`
          with assigned as (
            select a.scope_id, r.permissions
              from core.role_assignment a
              join core.role r on r.id = a.role_id
             where a.user_id = ${userId}
          )
          select s.id, s.parent_id,
                 coalesce(
                   (select array_agg(distinct p.key order by p.key)
                      from assigned x
                      cross join lateral unnest(x.permissions) as held (key)
                      join core.permission p on p.key = held.key and p.installed
                     where x.scope_id = s.id),
                   '{}'
                 ) as permissions
            from core.scope s
           where s.company_id in (
                   select c.company_id from core.scope c join assigned x on x.scope_id = c.id
                 )`.execute(tx);
        return rows;
      }),
    );
    const nodes: ScopeGrant[] = rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      permissions: row.permissions,
    }));
    return { userId, plantId, ...accessOf(nodes) };
  }
}
