// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Connection } from '@northmes/sdk/lists';
import type { Transaction } from 'kysely';
import { type UserListArgs, userList } from '../api/user/queries/user.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { requestScope } from './access/request-scope.ts';

/** A user as core's service hands it out. */
export interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly blocked: boolean;
}

/** The columns of core.user_directory that make a UserRecord. */
const userColumns = ['id', 'name', 'username', 'banned as blocked'] as const;

/**
 * The users of a company in a transaction: the members of its organization and every holder of one
 * of its roles (core.company_user).
 */
export function companyUsers(tx: Transaction<CoreDatabase>, companyId: string) {
  return tx
    .selectFrom('core.user_directory')
    .select(userColumns)
    .where('id', 'in', (users) =>
      users.selectFrom('core.company_user').select('user_id').where('company_id', '=', companyId),
    );
}

/**
 * Reads the users of the request's company (ADR 0010). Each read needs core.user:read at the
 * request's plant.
 */
@Injectable()
export class UserService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** One page of the users of the request's company, as coreUsers' arguments ask. */
  list(args: UserListArgs): Promise<Connection<UserRecord>> {
    const { companyId } = requestScope('core.user:read');
    return userList.page(this.db, (tx) => companyUsers(tx, companyId), args);
  }

  /** The user with this id among the users of the request's company, or null. */
  async byId(id: string): Promise<UserRecord | null> {
    const { companyId } = requestScope('core.user:read');
    const user = await this.db.transaction((tx) =>
      companyUsers(tx, companyId).where('id', '=', id).executeTakeFirst(),
    );
    return user ?? null;
  }
}
