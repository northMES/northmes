// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import type { Connection } from '@northmes/sdk/lists';
import { type UserRecord, UserService } from '../../../core/user.service.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { User } from '../types/user.type.ts';
import { type UserListArgs, userList } from './user.list.ts';

/**
 * core's queries on User. Each needs core.user:read at the request's plant, or in company settings
 * at the company the request names.
 */
@Resolver(() => User)
export class UserQueryResolver {
  constructor(@Inject(UserService) private readonly users: UserService) {}

  /**
   * One page of the users of the company: the members of the company and everyone who holds one of
   * its roles, with search, orderBy and paging.
   */
  @Query(() => userList.Connection)
  @PlantFree()
  coreUsers(
    @Args({ type: () => userList.Args }) args: UserListArgs,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<Connection<UserRecord>> {
    return this.users.list(args, companyId ?? undefined);
  }

  /** The user with this id among the users of the company, or null. */
  @Query(() => User, { nullable: true })
  @PlantFree()
  coreUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<UserRecord | null> {
    return this.users.byId(id, companyId ?? undefined);
  }
}
