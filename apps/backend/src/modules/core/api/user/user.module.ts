// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleServiceModule } from '../../core/role-service.module.ts';
import { UserServiceModule } from '../../core/user-service.module.ts';
import { UserFieldResolver } from './fields/user.field.resolver.ts';
import { BlockUser } from './mutations/block-user.mutation.ts';
import { CreateUser } from './mutations/create-user.mutation.ts';
import { ResetPassword } from './mutations/reset-password.mutation.ts';
import { UnblockUser } from './mutations/unblock-user.mutation.ts';
import { userList } from './queries/user.list.ts';
import { UserQueryResolver } from './queries/user.query.resolver.ts';

/** core's GraphQL surface for User: its queries, its access fields and the user commands. */
@Module({
  imports: [UserServiceModule, RoleServiceModule],
  providers: [
    UserQueryResolver,
    userList.ConnectionResolver,
    UserFieldResolver,
    CreateUser,
    BlockUser,
    UnblockUser,
    ResetPassword,
  ],
})
export class UserModule {}
