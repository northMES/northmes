// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import type { Connection } from '@northmes/sdk/lists';
import { type UserRecord, UserService } from '../../../core/user.service.ts';
import { User } from '../types/user.type.ts';
import { type UserListArgs, userList } from './user.list.ts';

/** core's queries on User. Each needs core.user:read at the request's plant. */
@Resolver(() => User)
export class UserQueryResolver {
  constructor(@Inject(UserService) private readonly users: UserService) {}

  /**
   * One page of the users of the company of the request's plant: the members of the company and
   * everyone who holds one of its roles, with search, orderBy and paging.
   */
  @Query(() => userList.Connection)
  coreUsers(
    @Args({ type: () => userList.Args }) args: UserListArgs,
  ): Promise<Connection<UserRecord>> {
    return this.users.list(args);
  }

  /** The user with this id among the users of the company of the request's plant, or null. */
  @Query(() => User, { nullable: true })
  coreUser(@Args('id', { type: () => ID }) id: string): Promise<UserRecord | null> {
    return this.users.byId(id);
  }
}
