// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Connection } from '@northmes/sdk/lists';
import { sql, type Transaction } from 'kysely';
import { type UserListArgs, userList } from '../api/user/queries/user.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { readIn, requestScope } from './access/request-scope.ts';

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

/** What coreUsers narrows its list to: the holders of a role, and blocked or active users. */
export interface UserFilter {
  readonly roleId?: string;
  readonly blocked?: boolean;
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
   * filter: the holders of a role of the company where the request reads assignments (at a plant,
   * the plant and the company; in company settings, the company and every plant of it), and blocked
   * or active users.
   */
  async list(
    args: UserListArgs,
    companyId?: string,
    { roleId, blocked }: UserFilter = {},
  ): Promise<Connection<UserRecord>> {
    const scope = requestScope('core.user:read', companyId);
    const page = await readIn(scope, () =>
      userList.page(
        this.db,
        (tx) => {
          let users = companyUsers(tx, scope.companyId);
          if (roleId !== undefined) {
            const { companyId, plantId } = scope;
            users = users.where('id', 'in', (holders) => {
              const inCompany = holders
                .selectFrom('core.role_assignment')
                .select('user_id')
                .where('company_id', '=', companyId)
                .where('role_id', '=', roleId);
              // At a plant, as roleAssignments reads them: never another plant's assignments.
              return plantId === undefined
                ? inCompany
                : inCompany.where('scope_id', 'in', [plantId, companyId]);
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
