// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Connection } from '@northmes/sdk/lists';
import { sql, type Transaction } from 'kysely';
import { type UserListArgs, userList } from '../api/user/queries/user.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { type RequestScope, readIn, requestScope } from './access/request-scope.ts';

/** A user as core's service hands it out. */
export interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly blocked: boolean;
  /**
   * The company the user was read in, where the fields of User read the user's access. Company
   * settings name it, because their requests carry no plant (ADR 0066).
   */
  readonly companyId?: string;
}

/**
 * What coreUsers narrows its list to: the holders of a role, the holders of an assignment at a
 * place, and blocked or active users. With both roleId and placeId, one assignment matches both.
 */
export interface UserFilter {
  readonly roleId?: string;
  /** A scope id: the company, or a plant, whose holders also include the company's (ADR 0091). */
  readonly placeId?: string;
  readonly blocked?: boolean;
}

/**
 * The scopes where an assignment counts for the place filter, narrowed to the request's read
 * (ADR 0091): the company keeps the company; a plant the read covers keeps the plant and the
 * company, since a company role applies at every plant. Without a place, every scope the read
 * covers: at a plant, the plant and the company; in company settings, undefined for all of them.
 * Any other place answers an empty list, because row-level security reads every assignment.
 */
function placeScopes(
  scope: RequestScope,
  placeId: string | undefined,
): readonly string[] | undefined {
  const { companyId, plantId, principal } = scope;
  if (placeId === undefined) return plantId === undefined ? undefined : [plantId, companyId];
  if (placeId === companyId) return [companyId];
  const inRead =
    plantId === undefined
      ? principal.scopes.get(placeId)?.parentId === companyId
      : placeId === plantId;
  return inRead ? [placeId, companyId] : [];
}

/** The columns of core.user_directory that make a UserRecord. */
const userColumns = ['id', 'name', 'username', 'banned as blocked'] as const;

/**
 * The users of a company in a transaction: the members of its organization and every holder of one
 * of its roles (core.company_user), each with the company it was read in.
 */
export function companyUsers(tx: Transaction<CoreDatabase>, companyId: string) {
  return tx
    .selectFrom('core.user_directory')
    .select(userColumns)
    .select(sql<string>`${companyId}::uuid`.as('companyId'))
    .where('id', 'in', (users) =>
      users.selectFrom('core.company_user').select('user_id').where('company_id', '=', companyId),
    );
}

/**
 * Reads the users of a company (ADR 0010): the company of the request's plant, or in company
 * settings the company the request names (ADR 0066). Each read needs core.user:read there.
 */
@Injectable()
export class UserService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /**
   * One page of the users of the request's company, as coreUsers' arguments ask, narrowed by the
   * filter: the holders of a role of the company, or of a role at a place (ADR 0091), where the
   * request reads assignments (at a plant, the plant and the company; in company settings, the
   * company and every plant of it), and blocked or active users.
   */
  async list(
    args: UserListArgs,
    companyId?: string,
    { roleId, placeId, blocked }: UserFilter = {},
  ): Promise<Connection<UserRecord>> {
    const scope = requestScope('core.user:read', companyId);
    const places = placeScopes(scope, placeId);
    const page = await readIn(scope, () =>
      userList.page(
        this.db,
        (tx) => {
          let users = companyUsers(tx, scope.companyId);
          if (roleId !== undefined || placeId !== undefined) {
            users = users.where('id', 'in', (holders) => {
              let held = holders
                .selectFrom('core.role_assignment')
                .select('user_id')
                .where('company_id', '=', scope.companyId);
              if (roleId !== undefined) held = held.where('role_id', '=', roleId);
              // At a plant, as roleAssignments reads them: never another plant's assignments.
              if (places !== undefined) {
                held =
                  places.length === 0
                    ? held.where(sql<boolean>`false`)
                    : held.where('scope_id', 'in', places);
              }
              return held;
            });
          }
          if (blocked !== undefined) users = users.where('banned', '=', blocked);
          return users;
        },
        args,
      ),
    );
    // totalCount counts later, in its own resolver, so it reads where the page did.
    return { ...page, count: () => readIn(scope, () => page.count()) };
  }

  /** The user with this id among the users of the request's company, or null. */
  async byId(id: string, companyId?: string): Promise<UserRecord | null> {
    const scope = requestScope('core.user:read', companyId);
    const user = await readIn(scope, () =>
      this.db.transaction((tx) =>
        companyUsers(tx, scope.companyId).where('id', '=', id).executeTakeFirst(),
      ),
    );
    return user ?? null;
  }
}
